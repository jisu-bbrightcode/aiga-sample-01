import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { DrizzleDB } from "@repo/drizzle";
import { InjectDrizzle } from "@repo/drizzle";
import {
  adminAuditLog,
  type ServiceSearchSynonym,
  serviceSearchSynonyms,
} from "@repo/drizzle/schema";
import { and, asc, desc, eq, ilike, lt, sql } from "drizzle-orm";
import type {
  CreateSynonymDto,
  ListSynonymsQueryDto,
  SynonymStatus,
  UpdateSynonymDto,
} from "../dto";
import { toSynonym } from "../mappers-synonyms";
import { normalizeExpansions, normalizeSynonymTerm } from "../synonyms-normalize";

/** Postgres unique-violation SQLSTATE — surfaced as a friendly 409. */
const PG_UNIQUE_VIOLATION = "23505";

/**
 * Change-history (변경 이력) lives in the shared `admin_audit_log` (PB-ADMIN-001),
 * the same append-only store the admin audit viewer reads — so a synonym edit
 * shows up consistently wherever admin history is surfaced. `targetType` keys
 * the rows to this resource; `action` distinguishes a content edit from a
 * status transition.
 */
const SYNONYM_AUDIT_TARGET_TYPE = "service_search_synonym";
const SYNONYM_AUDIT_ACTION = {
  updated: "search_synonym.updated",
  statusChanged: "search_synonym.status_changed",
} as const;

/** A drizzle update set — only the fields a synonym edit may touch. */
type SynonymPatch = Partial<
  Pick<ServiceSearchSynonym, "term" | "expansions" | "specialtyId" | "notes">
>;

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
    return toSynonym(await this.loadOr404(id));
  }

  /**
   * Partial update of a synonym's editable content (term / expansions /
   * specialtyId / notes). Only fields actually present in the patch are
   * touched; `isActive` is NOT updatable here — status changes go through
   * `setSynonymStatus` so the allowed transition + 변경 이력 are enforced in one
   * place.
   *
   * The "no expansion equals the term" invariant is preserved: if the term
   * changes, the expansions are re-normalized against the new term (and a patch
   * that would leave them empty is a 409). The row update and its change-history
   * entry are written in a single transaction so the two never diverge.
   */
  async updateSynonym(actorId: string, id: string, dto: UpdateSynonymDto) {
    const existing = await this.loadOr404(id);

    const patch = this.buildSynonymPatch(existing, dto);
    if (Object.keys(patch).length === 0) {
      // Nothing materially changed — idempotent no-op, no history written.
      return toSynonym(existing);
    }

    try {
      const updated = await this.db.transaction(async (tx) => {
        const rows = await tx
          .update(serviceSearchSynonyms)
          .set(patch)
          .where(eq(serviceSearchSynonyms.id, id))
          .returning();
        const row = this.firstOrThrow(rows);
        await tx.insert(adminAuditLog).values({
          actorUserId: actorId,
          action: SYNONYM_AUDIT_ACTION.updated,
          targetType: SYNONYM_AUDIT_TARGET_TYPE,
          targetId: id,
          payloadBefore: this.auditSnapshot(existing) as never,
          payloadAfter: this.auditSnapshot({ ...existing, ...patch }) as never,
        });
        return row;
      });

      this.logger.log(
        `[audit] search synonym updated id=${id} fields=${Object.keys(patch).join(",")} actor=${actorId}`,
      );
      return toSynonym(updated);
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  /**
   * Status-change action: activate ↔ deactivate. The two states are the only
   * allowed transitions (the DTO enum rejects anything else at the boundary).
   * A request that matches the current state is an idempotent no-op (no history
   * row). A real transition flips `isActive` and records a change-history entry
   * in the same transaction.
   */
  async setSynonymStatus(actorId: string, id: string, status: SynonymStatus, reason?: string) {
    const existing = await this.loadOr404(id);
    const targetActive = status === "active";

    if (existing.isActive === targetActive) {
      return toSynonym(existing);
    }

    const updated = await this.db.transaction(async (tx) => {
      const rows = await tx
        .update(serviceSearchSynonyms)
        .set({ isActive: targetActive })
        .where(eq(serviceSearchSynonyms.id, id))
        .returning();
      const row = this.firstOrThrow(rows);
      await tx.insert(adminAuditLog).values({
        actorUserId: actorId,
        action: SYNONYM_AUDIT_ACTION.statusChanged,
        targetType: SYNONYM_AUDIT_TARGET_TYPE,
        targetId: id,
        payloadBefore: { isActive: existing.isActive } as never,
        payloadAfter: { isActive: targetActive } as never,
        reason: reason ?? null,
      });
      return row;
    });

    this.logger.log(
      `[audit] search synonym status id=${id} ${existing.isActive}->${targetActive} actor=${actorId}`,
    );
    return toSynonym(updated);
  }

  /**
   * Change-history (변경 이력) for one synonym: newest-first audit entries from
   * `admin_audit_log` scoped to this resource. 404 if the synonym does not
   * exist (don't surface history for an unknown id). Keyset pagination on the
   * audit-log id; an unparseable cursor falls back to the first page.
   */
  async listSynonymHistory(id: string, opts: { limit: number; cursor?: string }) {
    await this.loadOr404(id);

    const cursorId = this.parseCursor(opts.cursor);
    const where = and(
      eq(adminAuditLog.targetType, SYNONYM_AUDIT_TARGET_TYPE),
      eq(adminAuditLog.targetId, id),
      cursorId === undefined ? undefined : lt(adminAuditLog.id, cursorId),
    );

    const rows = await this.db
      .select()
      .from(adminAuditLog)
      .where(where)
      .orderBy(desc(adminAuditLog.id))
      .limit(opts.limit);

    const last = rows[rows.length - 1];
    const nextCursor = rows.length === opts.limit && last ? last.id.toString() : null;

    return {
      items: rows.map((row) => ({
        id: row.id.toString(),
        action: row.action,
        actorUserId: row.actorUserId,
        payloadBefore: row.payloadBefore,
        payloadAfter: row.payloadAfter,
        reason: row.reason ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
      nextCursor,
    };
  }

  /** Load a synonym row or raise the shared 404. */
  private async loadOr404(id: string): Promise<ServiceSearchSynonym> {
    const [row] = await this.db
      .select()
      .from(serviceSearchSynonyms)
      .where(eq(serviceSearchSynonyms.id, id))
      .limit(1);
    if (!row) {
      throw new NotFoundException("검색 동의어를 찾을 수 없습니다.");
    }
    return row;
  }

  /**
   * Compute the minimal set of changed fields from a partial update. Term and
   * expansions are normalized; a term change forces expansions to be
   * re-validated against the new term so no expansion ever equals it.
   */
  private buildSynonymPatch(existing: ServiceSearchSynonym, dto: UpdateSynonymDto): SynonymPatch {
    const patch: SynonymPatch = {};

    const finalTerm = dto.term === undefined ? existing.term : normalizeSynonymTerm(dto.term);
    if (finalTerm !== existing.term) {
      patch.term = finalTerm;
    }

    const expansions = this.resolveExpansions(existing, dto, finalTerm);
    if (expansions !== undefined) {
      patch.expansions = expansions;
    }

    if (this.fieldChanged(dto.specialtyId, existing.specialtyId)) {
      patch.specialtyId = dto.specialtyId ?? null;
    }
    if (this.fieldChanged(dto.notes, existing.notes)) {
      patch.notes = dto.notes ?? null;
    }

    return patch;
  }

  /**
   * Decide the expansions to write, or `undefined` when they need no change.
   * Expansions are recomputed when supplied OR when the term changed (to keep
   * the "no expansion equals the term" invariant); an empty result is a 409.
   */
  private resolveExpansions(
    existing: ServiceSearchSynonym,
    dto: UpdateSynonymDto,
    finalTerm: string,
  ): string[] | undefined {
    const termChanged = finalTerm !== existing.term;
    if (dto.expansions === undefined && !termChanged) {
      return undefined;
    }
    const expansions = normalizeExpansions(dto.expansions ?? existing.expansions, finalTerm);
    if (expansions.length === 0) {
      throw new ConflictException(
        "확장어가 검색어와 동일하거나 비어 있습니다. 다른 확장어를 입력해주세요.",
      );
    }
    return arraysEqual(expansions, existing.expansions) ? undefined : expansions;
  }

  /** A nullable field changed iff it was supplied and differs from the stored value. */
  private fieldChanged(next: string | null | undefined, current: string | null): boolean {
    return next !== undefined && (next ?? null) !== (current ?? null);
  }

  /** The content fields captured in a change-history snapshot. */
  private auditSnapshot(
    row: Pick<ServiceSearchSynonym, "term" | "expansions" | "specialtyId" | "notes">,
  ) {
    return {
      term: row.term,
      expansions: row.expansions,
      specialtyId: row.specialtyId ?? null,
      notes: row.notes ?? null,
    };
  }

  /** Parse an opaque history cursor; an invalid value yields the first page. */
  private parseCursor(cursor?: string): bigint | undefined {
    if (!cursor) return undefined;
    try {
      return BigInt(cursor);
    } catch {
      return undefined;
    }
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

/** Order-sensitive shallow equality for normalized expansion lists. */
function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}
