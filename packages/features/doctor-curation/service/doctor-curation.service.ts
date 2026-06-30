import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import type { User } from "@repo/core/nestjs/auth";
import type { DrizzleDB } from "@repo/drizzle";
import { InjectDrizzle } from "@repo/drizzle";
import {
  type ServiceDoctorCollection,
  serviceDoctorCollectionItems,
  serviceDoctorCollections,
} from "@repo/drizzle/schema";
import { AdminAuditService } from "@repo/features/_common";
import { and, asc, desc, eq, ilike, sql } from "drizzle-orm";
import type {
  ChangeStatusDto,
  CollectionHistoryQueryDto,
  CreateCollectionDto,
  ListCollectionsQueryDto,
  PublicListCollectionsQueryDto,
  UpdateCollectionDto,
} from "../dto";
import {
  buildViewerState,
  type PublicCollectionDetail,
  toAdminCollection,
  toAdminCollectionDetail,
  toPublicCollection,
  toPublicCollectionItem,
} from "../mappers";

/** Postgres unique-violation SQLSTATE — surfaced as a friendly 409. */
const PG_UNIQUE_VIOLATION = "23505";

const PUBLISHED = "published";
const DRAFT = "draft";
const ARCHIVED = "archived";

type CollectionStatus = ServiceDoctorCollection["status"];

/**
 * Allowed status transitions for a 명의 컬렉션 (acceptance: 허용된 상태 전이만).
 * A transition not listed here (including same → same) is rejected with 422.
 *   - draft → published (발행) / draft → archived (초안 폐기)
 *   - published → draft (수정 위해 비공개) / published → archived (운영 종료)
 *   - archived → draft (재편집용 복구; 재발행은 draft를 거쳐야 함)
 */
const STATUS_TRANSITIONS: Record<CollectionStatus, readonly CollectionStatus[]> = {
  draft: ["published", "archived"],
  published: ["draft", "archived"],
  archived: ["draft"],
};

/** Audit (변경 이력) descriptors written to `admin_audit_log`. */
const AUDIT_TARGET_TYPE = "doctor_collection";
const CollectionAuditAction = {
  updated: "doctor_collection.updated",
  statusChanged: "doctor_collection.status_changed",
} as const;

/** The transaction handle drizzle hands to a `db.transaction(...)` callback. */
type CurationDbTx = Parameters<Parameters<DrizzleDB["transaction"]>[0]>[0];

/**
 * Copy only the keys whose value is not `undefined` — implements PATCH
 * semantics where an omitted key is untouched but an explicit `null` is kept
 * (and clears a nullable column).
 */
function pickDefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(input) as (keyof T)[]) {
    if (input[key] !== undefined) {
      out[key] = input[key];
    }
  }
  return out;
}

/** A collection-item row joined with its doctor, as drizzle returns via `with`. */
interface PublicItemRow {
  rank: number;
  note: string | null;
  doctor: Parameters<typeof toPublicCollectionItem>[0]["doctor"] & {
    status: string;
    isDeleted: boolean;
  };
}

/**
 * 명의 큐레이션 service — FR-004 (BBR-538).
 *
 * Owns the editorial 명의 컬렉션 (`service_doctor_collections`) write/read API.
 * The raw 명의 browse/filter/sort surface is REUSED from the PB-DATA-001 doctor
 * hub and is NOT re-implemented here; this service manages the curation layer.
 */
@Injectable()
export class DoctorCurationService {
  private readonly logger = new Logger(DoctorCurationService.name);

  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly audit: AdminAuditService,
  ) {}

  // =========================================================================
  // Create (admin)
  // =========================================================================

  async createCollection(actorId: string, dto: CreateCollectionDto) {
    const { items, ...fields } = dto;
    try {
      const { collection, itemRows } = await this.db.transaction(async (tx) => {
        const rows = await tx
          .insert(serviceDoctorCollections)
          .values({
            ...fields,
            // 초기 상태: status defaults to 'draft'; publishedAt only stamped
            // when the collection is created already published.
            publishedAt: fields.status === PUBLISHED ? new Date() : null,
            createdBy: actorId,
            updatedBy: actorId,
          })
          .returning();
        const created = this.firstOrThrow(rows);

        const inserted = await this.insertItems(tx, created.id, items);
        return { collection: created, itemRows: inserted };
      });
      // The creator is, by construction, an admin (route is guard-gated).
      return {
        ...toAdminCollectionDetail(collection, itemRows),
        viewerState: buildViewerState("admin"),
      };
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  // =========================================================================
  // Update (admin) — partial field edit + optional 수록 의사 replacement
  // =========================================================================

  /**
   * Partial update of an editable collection. Only the fields present in `dto`
   * are written; nullable columns may be cleared with `null`. `status` is NOT
   * editable here (use {@link changeStatus}). The kind ↔ scope consistency is
   * validated against the merged row, and the change is recorded in the history
   * log with before/after snapshots.
   */
  async updateCollection(actorId: string, id: string, dto: UpdateCollectionDto) {
    const existing = await this.requireCollection(id);
    const { items, ...rest } = dto;
    const patch = pickDefined(rest);

    // kind ↔ scope정합: validate against the post-update (merged) values, since
    // the existing row may already carry the needed specialty/region scope.
    const mergedKind = patch.kind ?? existing.kind;
    const mergedSpecialtyId =
      "specialtyId" in patch ? (patch.specialtyId ?? null) : existing.specialtyId;
    const mergedRegionId = "regionId" in patch ? (patch.regionId ?? null) : existing.regionId;
    this.assertKindScope(mergedKind, mergedSpecialtyId, mergedRegionId);

    try {
      const { collection, itemRows } = await this.db.transaction(async (tx) => {
        const rows = await tx
          .update(serviceDoctorCollections)
          .set({ ...patch, updatedBy: actorId })
          .where(eq(serviceDoctorCollections.id, id))
          .returning();
        const updated = this.firstOrThrow(rows);

        // Replace the ordered 수록 의사 set only when the caller sent `items`.
        let itemRows: Awaited<ReturnType<typeof this.insertItems>>;
        if (items === undefined) {
          itemRows = await tx
            .select()
            .from(serviceDoctorCollectionItems)
            .where(eq(serviceDoctorCollectionItems.collectionId, id))
            .orderBy(asc(serviceDoctorCollectionItems.rank));
        } else {
          await tx
            .delete(serviceDoctorCollectionItems)
            .where(eq(serviceDoctorCollectionItems.collectionId, id));
          itemRows = await this.insertItems(tx, id, items);
        }
        return { collection: updated, itemRows };
      });

      await this.audit.log({
        actorUserId: actorId,
        action: CollectionAuditAction.updated,
        targetType: AUDIT_TARGET_TYPE,
        targetId: id,
        payloadBefore: toAdminCollection(existing),
        payloadAfter: toAdminCollection(collection),
      });

      return {
        ...toAdminCollectionDetail(collection, itemRows),
        viewerState: buildViewerState("admin"),
      };
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  // =========================================================================
  // Status change action (admin) — guarded by the allowed-transition map
  // =========================================================================

  /**
   * Move a collection to a new lifecycle status. Only transitions allowed by
   * {@link STATUS_TRANSITIONS} are accepted (otherwise 422); entering
   * `published` stamps `publishedAt`. The before/after status is appended to
   * the change history with the optional operator reason.
   */
  async changeStatus(actorId: string, id: string, dto: ChangeStatusDto) {
    const existing = await this.requireCollection(id);
    this.assertTransition(existing.status, dto.status);

    const rows = await this.db
      .update(serviceDoctorCollections)
      .set({
        status: dto.status,
        updatedBy: actorId,
        ...(dto.status === PUBLISHED ? { publishedAt: new Date() } : {}),
      })
      .where(
        and(eq(serviceDoctorCollections.id, id), eq(serviceDoctorCollections.isDeleted, false)),
      )
      .returning();
    const updated = this.firstOrThrow(rows);

    await this.audit.log({
      actorUserId: actorId,
      action: CollectionAuditAction.statusChanged,
      targetType: AUDIT_TARGET_TYPE,
      targetId: id,
      payloadBefore: { status: existing.status },
      payloadAfter: { status: updated.status },
      reason: dto.reason,
    });

    const items = await this.db
      .select()
      .from(serviceDoctorCollectionItems)
      .where(eq(serviceDoctorCollectionItems.collectionId, id))
      .orderBy(asc(serviceDoctorCollectionItems.rank));

    return {
      ...toAdminCollectionDetail(updated, items),
      viewerState: buildViewerState("admin"),
    };
  }

  // =========================================================================
  // Change history (admin) — read the collection's audit trail
  // =========================================================================

  async listCollectionHistory(id: string, query: CollectionHistoryQueryDto) {
    // 404 for a missing/deleted collection so history can't probe existence.
    await this.requireCollection(id);
    return this.audit.list({
      targetType: AUDIT_TARGET_TYPE,
      targetId: id,
      cursor: query.cursor,
      limit: query.limit,
    });
  }

  // =========================================================================

  async getCollectionById(id: string) {
    const collection = await this.requireCollection(id);
    // Admin detail is only reachable behind the admin guard, so the viewer is
    // always an operator with manage rights.
    return this.adminDetailResponse(collection);
  }

  async listCollections(query: ListCollectionsQueryDto) {
    const { page, limit, kind, status } = query;
    const where = and(
      eq(serviceDoctorCollections.isDeleted, false),
      kind ? eq(serviceDoctorCollections.kind, kind) : undefined,
      status ? eq(serviceDoctorCollections.status, status) : undefined,
    );

    const [rows, countRows] = await Promise.all([
      this.db
        .select()
        .from(serviceDoctorCollections)
        .where(where)
        .orderBy(desc(serviceDoctorCollections.updatedAt))
        .limit(limit)
        .offset((page - 1) * limit),
      this.db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(serviceDoctorCollections)
        .where(where),
    ]);

    return { items: rows.map(toAdminCollection), total: countRows[0]?.count ?? 0, page, limit };
  }

  // =========================================================================
  // Lifecycle: archive / soft-delete / restore (admin) — FR-004 (BBR-540)
  //
  // 모든 파괴적 동작은 soft 하고 되돌릴 수 있다 — 컬렉션 행과 수록 의사
  // (service_doctor_collection_items)는 항상 보존되므로, 연결된 편집 데이터와
  // 하위 이력/감사 참조가 살아남는다. 물리 DELETE 는 절대 발생하지 않는다.
  //
  //   archive  → status='archived'              : 공개/앱 노출 차단, 관리자 목록엔 유지
  //   delete   → isDeleted=true, deletedAt=now    : 공개/앱/관리자 기본 목록 모두 숨김
  //   restore  → isDeleted=false, status='draft'  : 안전한 비공개 draft 로 복구(자동 재게시 X)
  //
  // 노출 정책 (acceptance criteria):
  //   - 공개(site)/앱: status='published' AND isDeleted=false 만 노출 → archive·delete 모두 숨김
  //   - 관리자: isDeleted=false 인 행은 status 무관 노출 → archive 는 보이고 delete 는 숨김
  // =========================================================================

  /** 노출 차단(archive): 게시를 내려 공개/앱 노출만 차단하고 관리자 관리 대상으로 유지. */
  async archiveCollection(actorId: string, id: string) {
    // 활성(비삭제) 컬렉션만 archive 대상 — 삭제된 컬렉션은 먼저 restore 해야 한다.
    const collection = await this.requireCollection(id);
    if (collection.status === ARCHIVED) {
      // 멱등: 이미 archived 면 추가 write 없이 현재 상태를 반환한다.
      return this.adminDetailResponse(collection);
    }
    const updated = await this.applyCollectionPatch(id, { status: ARCHIVED, updatedBy: actorId });
    this.logger.log(`명의 컬렉션 archived id=${id} actor=${actorId}`);
    return this.adminDetailResponse(updated);
  }

  /** Soft delete: 연결 데이터는 보존한 채 모든 기본 노출면에서 숨긴다 (복구 가능). */
  async deleteCollection(actorId: string, id: string) {
    // isDeleted 필터 없이 조회 — '존재한 적 없음'(404)과 '이미 삭제됨'(멱등)을 구분한다.
    const collection = await this.requireAnyCollection(id);
    if (collection.isDeleted) {
      // 멱등: 이미 삭제 상태면 다시 write 하지 않고 현재 상태를 반환한다.
      return this.adminDetailResponse(collection);
    }
    const updated = await this.applyCollectionPatch(id, {
      isDeleted: true,
      deletedAt: new Date(),
      updatedBy: actorId,
    });
    this.logger.log(`명의 컬렉션 soft-deleted id=${id} actor=${actorId}`);
    return this.adminDetailResponse(updated);
  }

  /** 복구(restore): 삭제/archive 된 컬렉션을 안전한 draft 상태로 되살린다. */
  async restoreCollection(actorId: string, id: string) {
    const collection = await this.requireAnyCollection(id);
    // 이미 활성(비삭제·비archive) 상태면 변경 없이 멱등 반환 — 게시 상태를 함부로 내리지 않는다.
    if (!collection.isDeleted && collection.status !== ARCHIVED) {
      return this.adminDetailResponse(collection);
    }
    // 복구는 항상 비공개 draft 로 착지한다 — 실수로 다시 공개되지 않도록 관리자가 명시적으로 재게시한다.
    const updated = await this.applyCollectionPatch(id, {
      isDeleted: false,
      deletedAt: null,
      status: DRAFT,
      updatedBy: actorId,
    });
    this.logger.log(`명의 컬렉션 restored id=${id} actor=${actorId}`);
    return this.adminDetailResponse(updated);
  }

  // =========================================================================
  // Public browse (FR-004 / BBR-536) — published-only, public projection
  // =========================================================================

  async listPublicCollections(query: PublicListCollectionsQueryDto) {
    const { page, limit, kind, specialtyId, regionId, featured, q } = query;
    const where = and(
      eq(serviceDoctorCollections.status, PUBLISHED),
      eq(serviceDoctorCollections.isDeleted, false),
      kind ? eq(serviceDoctorCollections.kind, kind) : undefined,
      specialtyId ? eq(serviceDoctorCollections.specialtyId, specialtyId) : undefined,
      regionId ? eq(serviceDoctorCollections.regionId, regionId) : undefined,
      featured === true ? eq(serviceDoctorCollections.isFeatured, true) : undefined,
      q ? ilike(serviceDoctorCollections.name, `%${q}%`) : undefined,
    );

    const [rows, countRows] = await Promise.all([
      this.db
        .select()
        .from(serviceDoctorCollections)
        .where(where)
        // public 명의 찾기 rail order: editorial sortOrder, then newest
        .orderBy(asc(serviceDoctorCollections.sortOrder), desc(serviceDoctorCollections.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
      this.db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(serviceDoctorCollections)
        .where(where),
    ]);

    return { items: rows.map(toPublicCollection), total: countRows[0]?.count ?? 0, page, limit };
  }

  async getPublicCollectionBySlug(slug: string, viewer?: User): Promise<PublicCollectionDetail> {
    const row = await this.db.query.serviceDoctorCollections.findFirst({
      where: and(
        eq(serviceDoctorCollections.slug, slug),
        eq(serviceDoctorCollections.status, PUBLISHED),
        eq(serviceDoctorCollections.isDeleted, false),
      ),
      with: { items: { with: { doctor: true } } },
    });

    if (!row) {
      // 없는 리소스와 비공개(draft/deleted) 리소스를 동일하게 404로 처리한다 —
      // 공개 탐색면에서 존재 여부가 새지 않도록 (no enumeration leak). 관리자는
      // 별도의 가드된 admin 상세 라우트로 미게시 컬렉션을 조회한다.
      throw new NotFoundException("명의 컬렉션을 찾을 수 없습니다.");
    }

    // Never surface a draft/deleted doctor through a published collection.
    const items = (row.items as PublicItemRow[])
      .filter((it) => it.doctor && it.doctor.status === PUBLISHED && !it.doctor.isDeleted)
      .sort((a, b) => a.rank - b.rank)
      .map(toPublicCollectionItem);

    return {
      ...toPublicCollection(row),
      items,
      viewerState: buildViewerState(viewer ? "member" : "guest"),
    };
  }

  // =========================================================================
  // Internals
  // =========================================================================

  /**
   * Enforce kind ↔ scope consistency (분야별→specialtyId, 지역별→regionId).
   * Mirrors the create DTO refine, but runs on merged values so a partial
   * update can rely on the scope already stored on the row.
   */
  private assertKindScope(
    kind: ServiceDoctorCollection["kind"],
    specialtyId: string | null,
    regionId: string | null,
  ) {
    if (kind === "specialty" && specialtyId == null) {
      throw new BadRequestException("분야별(specialty) 컬렉션은 specialtyId가 필요합니다.");
    }
    if (kind === "region" && regionId == null) {
      throw new BadRequestException("지역별(region) 컬렉션은 regionId가 필요합니다.");
    }
  }

  /** Reject any status transition not in the allowed map (허용된 상태 전이만). */
  private assertTransition(from: CollectionStatus, to: CollectionStatus) {
    if (!STATUS_TRANSITIONS[from].includes(to)) {
      throw new UnprocessableEntityException(
        `'${from}' 상태에서 '${to}' 상태로 변경할 수 없습니다.`,
      );
    }
  }

  /** A create/update `.returning()` always yields one row; assert it for the type system. */
  private firstOrThrow<T>(rows: T[]): T {
    const row = rows[0];
    if (!row) {
      throw new Error("Write returned no row");
    }
    return row;
  }

  private async requireCollection(id: string) {
    const [row] = await this.db
      .select()
      .from(serviceDoctorCollections)
      .where(
        and(eq(serviceDoctorCollections.id, id), eq(serviceDoctorCollections.isDeleted, false)),
      )
      .limit(1);
    if (!row) {
      throw new NotFoundException("명의 컬렉션을 찾을 수 없습니다.");
    }
    return row;
  }

  /** Look up a collection in ANY state (incl. soft-deleted); 404 only if it never existed. */
  private async requireAnyCollection(id: string) {
    const [row] = await this.db
      .select()
      .from(serviceDoctorCollections)
      .where(eq(serviceDoctorCollections.id, id))
      .limit(1);
    if (!row) {
      throw new NotFoundException("명의 컬렉션을 찾을 수 없습니다.");
    }
    return row;
  }

  /** Apply a partial state change to a collection and return the updated row. */
  private async applyCollectionPatch(
    id: string,
    patch: Partial<typeof serviceDoctorCollections.$inferInsert>,
  ) {
    const rows = await this.db
      .update(serviceDoctorCollections)
      .set(patch)
      .where(eq(serviceDoctorCollections.id, id))
      .returning();
    return this.firstOrThrow(rows);
  }

  /** Admin detail response = full row + ordered 수록 의사 + admin viewer state. */
  private async adminDetailResponse(collection: ServiceDoctorCollection) {
    const items = await this.db
      .select()
      .from(serviceDoctorCollectionItems)
      .where(eq(serviceDoctorCollectionItems.collectionId, collection.id))
      .orderBy(asc(serviceDoctorCollectionItems.rank));
    return {
      ...toAdminCollectionDetail(collection, items),
      viewerState: buildViewerState("admin"),
    };
  }

  private async insertItems(
    tx: CurationDbTx,
    collectionId: string,
    items: CreateCollectionDto["items"],
  ) {
    if (!items || items.length === 0) {
      return [];
    }
    const rows = await tx
      .insert(serviceDoctorCollectionItems)
      .values(
        items.map((item) => ({
          collectionId,
          doctorId: item.doctorId,
          rank: item.rank,
          note: item.note,
        })),
      )
      .returning();
    return rows;
  }

  private mapWriteError(error: unknown): Error {
    if (typeof error === "object" && error !== null && "code" in error) {
      const code = (error as { code?: string }).code;
      if (code === PG_UNIQUE_VIOLATION) {
        return new ConflictException("이미 사용 중인 slug입니다. 다른 slug를 사용해주세요.");
      }
    }
    this.logger.error(
      "명의 컬렉션 write failed",
      error instanceof Error ? error.stack : String(error),
    );
    return error instanceof Error ? error : new Error(String(error));
  }
}
