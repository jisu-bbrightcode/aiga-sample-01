import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { DrizzleDB } from "@repo/drizzle";
import { InjectDrizzle } from "@repo/drizzle";
import { serviceSearchSynonyms } from "@repo/drizzle/schema";
import { and, asc, eq, ilike, sql } from "drizzle-orm";
import type { CreateSynonymDto, ListSynonymsQueryDto } from "../dto";
import { toSynonym } from "../mappers-synonyms";
import { normalizeExpansions, normalizeSynonymTerm } from "../synonyms-normalize";

/** Postgres unique-violation SQLSTATE — surfaced as a friendly 409. */
const PG_UNIQUE_VIOLATION = "23505";

/**
 * 통합검색 synonym admin service (FR-003 create — BBR-533).
 *
 * Owns create + browse of the admin-curated search synonyms. The list/search
 * read path and the reindex job are separate surfaces (BBR-531); synonyms are
 * the one operator-created, mutable FR-003 resource. Documents are a
 * rebuildable projection and queries are an append-only log — neither is
 * POST-created.
 */
@Injectable()
export class ServiceSearchSynonymsService {
  private readonly logger = new Logger(ServiceSearchSynonymsService.name);

  constructor(@InjectDrizzle() private readonly db: DrizzleDB) {}

  /**
   * Create a search synonym. Normalizes the term + expansions, defaults the
   * initial state to active, and writes a structured audit line capturing the
   * acting admin. A duplicate canonical term maps to a friendly 409.
   */
  async createSynonym(actorId: string, dto: CreateSynonymDto) {
    const term = normalizeSynonymTerm(dto.term);
    const expansions = normalizeExpansions(dto.expansions, term);
    if (expansions.length === 0) {
      throw new ConflictException(
        "확장어가 검색어와 동일하거나 비어 있습니다. 다른 확장어를 입력해주세요.",
      );
    }

    try {
      const rows = await this.db
        .insert(serviceSearchSynonyms)
        .values({
          term,
          expansions,
          specialtyId: dto.specialtyId ?? null,
          isActive: dto.isActive ?? true,
          notes: dto.notes ?? null,
        })
        .returning();
      const created = this.firstOrThrow(rows);

      // Audit log (server-side, non-user-facing): who created which synonym.
      this.logger.log(
        `[audit] search synonym created id=${created.id} term="${created.term}" ` +
          `expansions=${created.expansions.length} active=${created.isActive} actor=${actorId}`,
      );

      return toSynonym(created);
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  /** Admin browse: paginated synonyms, optionally filtered by state / term. */
  async listSynonyms(query: ListSynonymsQueryDto) {
    const { page, limit, active, q } = query;
    const where = and(
      active === undefined ? undefined : eq(serviceSearchSynonyms.isActive, active),
      q ? ilike(serviceSearchSynonyms.term, `%${normalizeSynonymTerm(q)}%`) : undefined,
    );

    const [rows, countRows] = await Promise.all([
      this.db
        .select()
        .from(serviceSearchSynonyms)
        .where(where)
        .orderBy(asc(serviceSearchSynonyms.term))
        .limit(limit)
        .offset((page - 1) * limit),
      this.db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(serviceSearchSynonyms)
        .where(where),
    ]);

    return { items: rows.map(toSynonym), total: countRows[0]?.count ?? 0, page, limit };
  }

  /** Admin detail: one synonym by id, or 404. */
  async getSynonymById(id: string) {
    const [row] = await this.db
      .select()
      .from(serviceSearchSynonyms)
      .where(eq(serviceSearchSynonyms.id, id))
      .limit(1);
    if (!row) {
      throw new NotFoundException("검색 동의어를 찾을 수 없습니다.");
    }
    return toSynonym(row);
  }

  /** A create `.returning()` always yields one row; assert it for the type system. */
  private firstOrThrow<T>(rows: T[]): T {
    const row = rows[0];
    if (!row) {
      throw new Error("Write returned no row");
    }
    return row;
  }

  private mapWriteError(error: unknown): Error {
    if (typeof error === "object" && error !== null && "code" in error) {
      if ((error as { code?: string }).code === PG_UNIQUE_VIOLATION) {
        return new ConflictException("이미 등록된 검색어입니다. 기존 동의어를 수정해주세요.");
      }
    }
    this.logger.error(
      "search synonym write failed",
      error instanceof Error ? error.stack : String(error),
    );
    return error instanceof Error ? error : new Error(String(error));
  }
}
