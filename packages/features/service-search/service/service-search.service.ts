import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { DrizzleDB } from "@repo/drizzle";
import { InjectDrizzle } from "@repo/drizzle";
import {
  type ServiceSearchDocument,
  serviceSearchDocuments,
  serviceSearchQueries,
} from "@repo/drizzle/schema";
import { and, desc, eq, gt, type SQL, sql } from "drizzle-orm";
import type { AdminSearchQueryDto, SearchQueryDto } from "../dto";
import { SEARCH_ENTITY_TYPES } from "../dto";
import {
  type AdminSearchHit,
  type ArchiveResult,
  type PublicSearchHit,
  toAdminSearchHit,
  toArchiveResult,
} from "../mappers";
import { normalizeQuery, resolveSortMode, type SearchSortMode } from "../normalize";

type SearchEntityType = ServiceSearchDocument["entityType"];

const doc = serviceSearchDocuments;
const queries = serviceSearchQueries;

/** Columns the public list exposes (index internals are never selected here). */
const PUBLIC_COLUMNS = {
  entityType: doc.entityType,
  entityId: doc.entityId,
  title: doc.title,
  subtitle: doc.subtitle,
  slug: doc.slug,
  photoUrl: doc.photoUrl,
  regionId: doc.regionId,
  specialtyId: doc.specialtyId,
  ratingAvg: doc.ratingAvg,
} as const;

const countExpr = sql<number>`cast(count(*) as int)`;

interface SearchFilters {
  q?: string;
  type?: SearchQueryDto["type"];
  regionId?: string;
  specialtyId?: string;
}

/**
 * 통합검색 service (FR-003 / BBR-531).
 *
 * Reads the rebuildable `service_search_documents` projection (PB-DATA-FR003)
 * and ranks across every catalog entity type in one query — the "통합" in
 * 통합검색. Ranking combines the weighted full-text vector (`search_vector`,
 * GIN-indexed) with trigram similarity on the title (typo/substring recall via
 * pg_trgm) and the editorial `weight` boost.
 *
 * Permission tiers:
 * - public/user (`search`):  forces `is_published = true`, returns public
 *   fields only, and append-logs the query for 인기/최근 검색어.
 * - admin (`adminSearch`):   adds index internals + a publish-state filter so an
 *   editor can audit unpublished documents; never logs.
 */
@Injectable()
export class ServiceSearchService {
  private readonly logger = new Logger(ServiceSearchService.name);

  constructor(@InjectDrizzle() private readonly db: DrizzleDB) {}

  // =========================================================================
  // Public / user unified search
  // =========================================================================

  async search(
    query: SearchQueryDto,
    userId?: string,
  ): Promise<{ items: PublicSearchHit[]; total: number; page: number; limit: number }> {
    const { page, limit } = query;
    const where = this.buildWhere(query, { forcePublished: true });
    const orderBy = this.buildOrder(resolveSortMode(query.sort, Boolean(query.q)), query.q);

    const [rows, countRows] = await Promise.all([
      this.db
        .select(PUBLIC_COLUMNS)
        .from(doc)
        .where(where)
        .orderBy(...orderBy)
        .limit(limit)
        .offset((page - 1) * limit),
      this.db.select({ count: countExpr }).from(doc).where(where),
    ]);

    const total = countRows[0]?.count ?? 0;
    // Public search drives 인기/최근 검색어 — log only real searches (q present),
    // never a pure browse. Best-effort: a logging failure must not fail search.
    if (query.q) {
      await this.logQuery(query, total, userId);
    }

    return { items: rows.map((r) => ({ ...r })), total, page, limit };
  }

  // =========================================================================
  // Admin unified search (index internals + unpublished visibility)
  // =========================================================================

  async adminSearch(
    query: AdminSearchQueryDto,
  ): Promise<{ items: AdminSearchHit[]; total: number; page: number; limit: number }> {
    const { page, limit } = query;
    const where = this.buildWhere(query, {
      forcePublished: false,
      published: query.published,
      includeDeleted: query.includeDeleted,
    });
    const orderBy = this.buildOrder(resolveSortMode(query.sort, Boolean(query.q)), query.q);

    const [rows, countRows] = await Promise.all([
      this.db
        .select()
        .from(doc)
        .where(where)
        .orderBy(...orderBy)
        .limit(limit)
        .offset((page - 1) * limit),
      this.db.select({ count: countExpr }).from(doc).where(where),
    ]);

    return {
      items: rows.map(toAdminSearchHit),
      total: countRows[0]?.count ?? 0,
      page,
      limit,
    };
  }

  // =========================================================================
  // Unified detail (FR-003 / BBR-532)
  //
  // A detail lookup keyed by the unique (entityType, entityId) of the search
  // projection — the id every list hit already carries. Two tiers:
  //
  // - public (`getPublicDetail`):  forces is_published = true and selects only
  //   public columns. A missing OR unpublished document is indistinguishable —
  //   both raise 404, so a 비공개(unpublished) resource never leaks its
  //   existence through the public surface (no 403 here by design).
  // - admin (`getAdminDetail`):    no publish filter, full row incl. internals.
  //   Reachable only behind BetterAuthGuard + BetterAuthAdminGuard, so the
  //   401/403 contract for 권한 없는 접근 is enforced by the guards, and an
  //   admin may inspect unpublished documents.
  // =========================================================================

  /** Public detail: published-only, non-archived, public columns. 404 if missing. */
  async getPublicDetail(entityType: string, entityId: string): Promise<PublicSearchHit> {
    const type = this.assertEntityType(entityType);
    const rows = await this.db
      .select(PUBLIC_COLUMNS)
      .from(doc)
      .where(
        and(
          eq(doc.entityType, type),
          eq(doc.entityId, entityId),
          eq(doc.isPublished, true),
          eq(doc.isDeleted, false),
        ),
      )
      .limit(1);
    const row = rows[0];
    if (!row) {
      throw new NotFoundException("검색 결과를 찾을 수 없습니다.");
    }
    return { ...row };
  }

  /**
   * Admin detail: full row incl. internals + archive state, published OR not,
   * archived OR not. 404 if missing. An admin must be able to inspect an
   * archived document (to confirm/restore it), so archived rows are returned.
   */
  async getAdminDetail(entityType: string, entityId: string): Promise<AdminSearchHit> {
    const type = this.assertEntityType(entityType);
    const rows = await this.db
      .select()
      .from(doc)
      .where(and(eq(doc.entityType, type), eq(doc.entityId, entityId)))
      .limit(1);
    const row = rows[0];
    if (!row) {
      throw new NotFoundException("검색 문서를 찾을 수 없습니다.");
    }
    return toAdminSearchHit(row);
  }

  // =========================================================================
  // Archive / restore (FR-003 delete/archive — BBR-535)
  //
  // Soft-delete instead of a hard DELETE: the document row stays on disk, so a
  // result can be 노출 차단(hidden) from public/app/admin search and later
  // restored, and connected payment/history/audit data keyed off the source
  // `entityId` is never touched. The flag is admin-owned and survives reindex
  // (the reindex `set` block never writes is_deleted/deleted_at).
  //
  // Both operations are idempotent (REST DELETE semantics): archiving an
  // already-archived document, or restoring a live one, succeeds and returns
  // the current state. A missing document is 404.
  // =========================================================================

  /** Archive (soft-delete) a search document by its (entityType, entityId) key. */
  async archiveDocument(
    actorId: string,
    entityType: string,
    entityId: string,
  ): Promise<ArchiveResult> {
    const type = this.assertEntityType(entityType);
    const existing = await this.findDocument(type, entityId);

    // Idempotent: already archived → return current state without a re-write.
    if (existing.isDeleted) {
      return toArchiveResult(existing);
    }

    const [updated] = await this.db
      .update(doc)
      .set({ isDeleted: true, deletedAt: new Date() })
      .where(and(eq(doc.entityType, type), eq(doc.entityId, entityId)))
      .returning();
    const row = updated ?? existing;

    this.logger.log(
      `[audit] search document archived id=${row.id} entityType=${type} ` +
        `entityId=${entityId} actor=${actorId}`,
    );
    return toArchiveResult(row);
  }

  /** Restore a previously archived search document; idempotent for live rows. */
  async restoreDocument(
    actorId: string,
    entityType: string,
    entityId: string,
  ): Promise<ArchiveResult> {
    const type = this.assertEntityType(entityType);
    const existing = await this.findDocument(type, entityId);

    // Idempotent: not archived → already live, return current state.
    if (!existing.isDeleted) {
      return toArchiveResult(existing);
    }

    const [updated] = await this.db
      .update(doc)
      .set({ isDeleted: false, deletedAt: null })
      .where(and(eq(doc.entityType, type), eq(doc.entityId, entityId)))
      .returning();
    const row = updated ?? existing;

    this.logger.log(
      `[audit] search document restored id=${row.id} entityType=${type} ` +
        `entityId=${entityId} actor=${actorId}`,
    );
    return toArchiveResult(row);
  }

  /** Load a document by key regardless of publish/archive state, or 404. */
  private async findDocument(
    type: SearchEntityType,
    entityId: string,
  ): Promise<ServiceSearchDocument> {
    const rows = await this.db
      .select()
      .from(doc)
      .where(and(eq(doc.entityType, type), eq(doc.entityId, entityId)))
      .limit(1);
    const row = rows[0];
    if (!row) {
      throw new NotFoundException("검색 문서를 찾을 수 없습니다.");
    }
    return row;
  }

  /**
   * Narrow an untrusted path segment to a known entity type. An unknown type
   * names no real resource, so it is treated as 404 (not a 400) to keep the
   * detail contract single-coded: "no such resource".
   */
  private assertEntityType(value: string): SearchEntityType {
    if ((SEARCH_ENTITY_TYPES as readonly string[]).includes(value)) {
      return value as SearchEntityType;
    }
    throw new NotFoundException("검색 결과를 찾을 수 없습니다.");
  }

  // =========================================================================
  // Derived surfaces — 인기 검색어 (public) / 최근 검색어 (user)
  // =========================================================================

  /** Public 인기 검색어: top normalized terms in a recent window. Counts only. */
  async popularTerms(opts: {
    limit: number;
    days: number;
  }): Promise<Array<{ term: string; count: number }>> {
    const rows = await this.db
      .select({ term: queries.normalizedQuery, count: countExpr })
      .from(queries)
      .where(
        and(
          sql`${queries.createdAt} > now() - make_interval(days => ${opts.days})`,
          gt(queries.resultCount, 0),
        ),
      )
      .groupBy(queries.normalizedQuery)
      .orderBy(desc(countExpr))
      .limit(opts.limit);
    return rows.map((r) => ({ term: r.term, count: r.count }));
  }

  /** A signed-in user's own 최근 검색어 — distinct terms, newest first. */
  async recentTerms(
    userId: string,
    opts: { limit: number },
  ): Promise<Array<{ term: string; lastSearchedAt: string }>> {
    const lastSearchedAt = sql<string>`max(${queries.createdAt})`;
    const rows = await this.db
      .select({ term: queries.normalizedQuery, lastSearchedAt })
      .from(queries)
      .where(eq(queries.userId, userId))
      .groupBy(queries.normalizedQuery)
      .orderBy(desc(lastSearchedAt))
      .limit(opts.limit);
    return rows.map((r) => ({
      term: r.term,
      lastSearchedAt: this.toIso(r.lastSearchedAt),
    }));
  }

  // =========================================================================
  // Internals
  // =========================================================================

  private buildWhere(
    filters: SearchFilters,
    scope: { forcePublished: boolean; published?: boolean; includeDeleted?: boolean },
  ): SQL | undefined {
    const conditions: (SQL | undefined)[] = [];
    if (scope.forcePublished) {
      conditions.push(eq(doc.isPublished, true));
    } else if (scope.published !== undefined) {
      conditions.push(eq(doc.isPublished, scope.published));
    }
    // Archived (soft-deleted) documents are excluded by default — 노출 차단 —
    // on every public and admin read. Only an explicit admin includeDeleted
    // (to audit/restore) widens the scope.
    if (!scope.includeDeleted) {
      conditions.push(eq(doc.isDeleted, false));
    }
    if (filters.type) conditions.push(eq(doc.entityType, filters.type));
    if (filters.regionId) conditions.push(eq(doc.regionId, filters.regionId));
    if (filters.specialtyId) conditions.push(eq(doc.specialtyId, filters.specialtyId));
    if (filters.q) {
      // Full-text match OR trigram similarity on title (typo/substring recall).
      conditions.push(
        sql`(${doc.searchVector} @@ websearch_to_tsquery('simple', ${filters.q}) OR ${doc.title} % ${filters.q})`,
      );
    }
    return and(...conditions);
  }

  private buildOrder(sort: SearchSortMode, q?: string): SQL[] {
    if (sort === "relevance" && q) {
      const rank = sql`ts_rank(${doc.searchVector}, websearch_to_tsquery('simple', ${q})) + similarity(${doc.title}, ${q}) + (${doc.weight}::float / 100)`;
      return [desc(rank), desc(doc.ratingAvg)];
    }
    if (sort === "rating") {
      return [desc(doc.ratingAvg), desc(doc.weight)];
    }
    // featured / default: editorial weight first, then rating.
    return [desc(doc.weight), desc(doc.ratingAvg), desc(doc.createdAt)];
  }

  private async logQuery(
    filters: SearchFilters,
    resultCount: number,
    userId?: string,
  ): Promise<void> {
    if (!filters.q) return;
    try {
      await this.db.insert(serviceSearchQueries).values({
        rawQuery: filters.q.slice(0, 300),
        normalizedQuery: normalizeQuery(filters.q).slice(0, 300),
        userId: userId ?? null,
        entityType: filters.type ?? null,
        regionId: filters.regionId ?? null,
        specialtyId: filters.specialtyId ?? null,
        resultCount,
      });
    } catch (error) {
      this.logger.warn(
        `search query log failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private toIso(value: Date | string): string {
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
  }
}
