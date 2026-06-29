import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { DrizzleDB } from "@repo/drizzle";
import { InjectDrizzle } from "@repo/drizzle";
import { serviceDoctorCollectionItems, serviceDoctorCollections } from "@repo/drizzle/schema";
import { and, asc, desc, eq, ilike, sql } from "drizzle-orm";
import type {
  CreateCollectionDto,
  ListCollectionsQueryDto,
  PublicListCollectionsQueryDto,
} from "../dto";
import {
  type PublicCollectionDetail,
  toAdminCollection,
  toAdminCollectionDetail,
  toPublicCollection,
  toPublicCollectionItem,
} from "../mappers";

/** Postgres unique-violation SQLSTATE — surfaced as a friendly 409. */
const PG_UNIQUE_VIOLATION = "23505";

const PUBLISHED = "published";

/** The transaction handle drizzle hands to a `db.transaction(...)` callback. */
type CurationDbTx = Parameters<Parameters<DrizzleDB["transaction"]>[0]>[0];

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

  constructor(@InjectDrizzle() private readonly db: DrizzleDB) {}

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
      return toAdminCollectionDetail(collection, itemRows);
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  // =========================================================================
  // Read-back (admin) — proves a created collection is reflected in list/detail
  // =========================================================================

  async getCollectionById(id: string) {
    const collection = await this.requireCollection(id);
    const items = await this.db
      .select()
      .from(serviceDoctorCollectionItems)
      .where(eq(serviceDoctorCollectionItems.collectionId, id))
      .orderBy(asc(serviceDoctorCollectionItems.rank));
    return toAdminCollectionDetail(collection, items);
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

  async getPublicCollectionBySlug(slug: string): Promise<PublicCollectionDetail> {
    const row = await this.db.query.serviceDoctorCollections.findFirst({
      where: and(
        eq(serviceDoctorCollections.slug, slug),
        eq(serviceDoctorCollections.status, PUBLISHED),
        eq(serviceDoctorCollections.isDeleted, false),
      ),
      with: { items: { with: { doctor: true } } },
    });

    if (!row) {
      throw new NotFoundException("명의 컬렉션을 찾을 수 없습니다.");
    }

    // Never surface a draft/deleted doctor through a published collection.
    const items = (row.items as PublicItemRow[])
      .filter((it) => it.doctor && it.doctor.status === PUBLISHED && !it.doctor.isDeleted)
      .sort((a, b) => a.rank - b.rank)
      .map(toPublicCollectionItem);

    return { ...toPublicCollection(row), items };
  }

  // =========================================================================
  // Internals
  // =========================================================================

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
