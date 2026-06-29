import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { DrizzleDB } from "@repo/drizzle";
import { InjectDrizzle } from "@repo/drizzle";
import { serviceDoctorCollectionItems, serviceDoctorCollections } from "@repo/drizzle/schema";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { CreateCollectionDto, ListCollectionsQueryDto } from "../dto";
import { toAdminCollection, toAdminCollectionDetail } from "../mappers";

/** Postgres unique-violation SQLSTATE — surfaced as a friendly 409. */
const PG_UNIQUE_VIOLATION = "23505";

const PUBLISHED = "published";

/** The transaction handle drizzle hands to a `db.transaction(...)` callback. */
type CurationDbTx = Parameters<Parameters<DrizzleDB["transaction"]>[0]>[0];

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
