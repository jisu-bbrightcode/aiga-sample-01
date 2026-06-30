import { Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import type { DrizzleDB } from "@repo/drizzle";
import { InjectDrizzle } from "@repo/drizzle";
import { and, desc, eq, sql } from "drizzle-orm";
import type {
  CreateInterestInput,
  CreateSavedItemInput,
  InterestDto,
  ListQuery,
  SavedItemDto,
  SearchHistoryDto,
  UpdateSavedItemInput,
} from "../dto";
import { buildCursorPage, type CursorPage, decodeCursor } from "../helpers/cursor";
import { toInterestDto, toSavedItemDto, toSearchHistoryDto } from "../mappers";
import { interest, savedItem, searchHistory } from "../schema";

/**
 * Personalization list service (FR-002 / BBR-724).
 *
 * Reads the authenticated user's own saved items / interests / search history,
 * newest first, with keyset cursor pagination. Owner scope is enforced in every
 * query (`user_id = :userId`); the controller's auth guard guarantees a real
 * user id reaches here, and this WHERE clause is the data-layer backstop that
 * makes one user's records unreachable to another even if the guard were
 * bypassed. An empty result is a normal `{ items: [], nextCursor: null }`.
 */
@Injectable()
export class PersonalizationService {
  constructor(@InjectDrizzle() private readonly db: DrizzleDB) {}

  /**
   * Create (or idempotently return) a saved item for the owner (BBR-726).
   *
   * 중복 방지: the unique index `(user_id, target_type, target_id)` +
   * `onConflictDoNothing` make a repeated save a no-op that returns the existing
   * record instead of erroring — the friendly UX for a toggle-style "저장"
   * button, and the DB stays free of duplicate rows. `ownerUserId` comes from
   * the authenticated session (the controller guard guarantees it).
   */
  async createSavedItem(ownerUserId: string, input: CreateSavedItemInput): Promise<SavedItemDto> {
    const [inserted] = await this.db
      .insert(savedItem)
      .values({
        userId: ownerUserId,
        targetType: input.targetType,
        targetId: input.targetId,
        memo: input.memo ?? null,
        tags: input.tags ?? null,
      })
      .onConflictDoNothing({
        target: [savedItem.userId, savedItem.targetType, savedItem.targetId],
      })
      .returning();

    if (inserted) {
      return toSavedItemDto(inserted);
    }

    const [existing] = await this.db
      .select()
      .from(savedItem)
      .where(
        and(
          eq(savedItem.userId, ownerUserId),
          eq(savedItem.targetType, input.targetType),
          eq(savedItem.targetId, input.targetId),
        ),
      )
      .limit(1);
    if (!existing) {
      // onConflict skipped the insert but the row is unreadable (e.g. a
      // concurrent delete). Never leak DB detail to the caller.
      throw new ServiceUnavailableException(
        "저장을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
    }
    return toSavedItemDto(existing);
  }

  /**
   * Create (or idempotently return) an interest for the owner (BBR-726).
   * Same auth + 중복 방지 contract as {@link createSavedItem}.
   */
  async createInterest(ownerUserId: string, input: CreateInterestInput): Promise<InterestDto> {
    const [inserted] = await this.db
      .insert(interest)
      .values({
        userId: ownerUserId,
        targetType: input.targetType,
        targetId: input.targetId,
      })
      .onConflictDoNothing({
        target: [interest.userId, interest.targetType, interest.targetId],
      })
      .returning();

    if (inserted) {
      return toInterestDto(inserted);
    }

    const [existing] = await this.db
      .select()
      .from(interest)
      .where(
        and(
          eq(interest.userId, ownerUserId),
          eq(interest.targetType, input.targetType),
          eq(interest.targetId, input.targetId),
        ),
      )
      .limit(1);
    if (!existing) {
      throw new ServiceUnavailableException(
        "관심 추가를 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
    }
    return toInterestDto(existing);
  }

  /**
   * Update the editable fields (memo/tags) of one of the owner's saved items
   * (BBR-727).
   *
   * 소유자 스코프 강제 + 정보 비노출: the `WHERE id = :id AND user_id = :owner`
   * means a save that does not exist *and* a save owned by someone else both
   * match zero rows and yield the same 404 — a caller can never tell another
   * user's id apart from a non-existent one. Partial patch: only the fields the
   * caller actually sent are written (an omitted field is left untouched, an
   * explicit `null` clears it); the DTO guarantees at least one field is present,
   * and `updated_at` advances via the column's `$onUpdate`.
   */
  async updateSavedItem(
    ownerUserId: string,
    id: string,
    input: UpdateSavedItemInput,
  ): Promise<SavedItemDto> {
    const patch: { memo?: string | null; tags?: string[] | null } = {};
    if (input.memo !== undefined) {
      patch.memo = input.memo;
    }
    if (input.tags !== undefined) {
      patch.tags = input.tags;
    }

    const [updated] = await this.db
      .update(savedItem)
      .set(patch)
      .where(and(eq(savedItem.id, id), eq(savedItem.userId, ownerUserId)))
      .returning();

    if (!updated) {
      throw new NotFoundException("저장한 항목을 찾을 수 없습니다.");
    }
    return toSavedItemDto(updated);
  }

  /**
   * Remove one of the owner's saved items — 저장 해제 (BBR-729).
   *
   * 소유자 스코프 강제 + 정보 비노출: `WHERE id = :id AND user_id = :owner` means a
   * save that does not exist *and* one owned by another user both delete zero
   * rows and yield the same 404 — a caller can never distinguish another user's
   * id from a non-existent one. The owner id comes from the authenticated
   * session (the controller guard guarantees it).
   */
  async removeSavedItem(ownerUserId: string, id: string): Promise<void> {
    const deleted = await this.db
      .delete(savedItem)
      .where(and(eq(savedItem.id, id), eq(savedItem.userId, ownerUserId)))
      .returning({ id: savedItem.id });

    if (deleted.length === 0) {
      throw new NotFoundException("저장한 항목을 찾을 수 없습니다.");
    }
  }

  /**
   * Remove one of the owner's interests — 관심 해제 (BBR-729).
   * Same owner-scope + 404-no-leak contract as {@link removeSavedItem}.
   */
  async removeInterest(ownerUserId: string, id: string): Promise<void> {
    const deleted = await this.db
      .delete(interest)
      .where(and(eq(interest.id, id), eq(interest.userId, ownerUserId)))
      .returning({ id: interest.id });

    if (deleted.length === 0) {
      throw new NotFoundException("관심 항목을 찾을 수 없습니다.");
    }
  }

  async listSavedItems(userId: string, query: ListQuery): Promise<CursorPage<SavedItemDto>> {
    const { limit } = query;
    const cursor = decodeCursor(query.cursor);
    const rows = await this.db
      .select()
      .from(savedItem)
      .where(
        and(
          eq(savedItem.userId, userId),
          cursor
            ? sql`(${savedItem.createdAt}, ${savedItem.id}) < (${cursor.createdAt}, ${cursor.id})`
            : undefined,
        ),
      )
      .orderBy(desc(savedItem.createdAt), desc(savedItem.id))
      .limit(limit + 1);

    const page = buildCursorPage(rows, limit);
    return { items: page.items.map(toSavedItemDto), nextCursor: page.nextCursor };
  }

  async listInterests(userId: string, query: ListQuery): Promise<CursorPage<InterestDto>> {
    const { limit } = query;
    const cursor = decodeCursor(query.cursor);
    const rows = await this.db
      .select()
      .from(interest)
      .where(
        and(
          eq(interest.userId, userId),
          cursor
            ? sql`(${interest.createdAt}, ${interest.id}) < (${cursor.createdAt}, ${cursor.id})`
            : undefined,
        ),
      )
      .orderBy(desc(interest.createdAt), desc(interest.id))
      .limit(limit + 1);

    const page = buildCursorPage(rows, limit);
    return { items: page.items.map(toInterestDto), nextCursor: page.nextCursor };
  }

  async listSearchHistory(userId: string, query: ListQuery): Promise<CursorPage<SearchHistoryDto>> {
    const { limit } = query;
    const cursor = decodeCursor(query.cursor);
    const rows = await this.db
      .select()
      .from(searchHistory)
      .where(
        and(
          eq(searchHistory.userId, userId),
          cursor
            ? sql`(${searchHistory.createdAt}, ${searchHistory.id}) < (${cursor.createdAt}, ${cursor.id})`
            : undefined,
        ),
      )
      .orderBy(desc(searchHistory.createdAt), desc(searchHistory.id))
      .limit(limit + 1);

    const page = buildCursorPage(rows, limit);
    return { items: page.items.map(toSearchHistoryDto), nextCursor: page.nextCursor };
  }
}
