import { Injectable, NotFoundException } from "@nestjs/common";
import type { DrizzleDB } from "@repo/drizzle";
import { InjectDrizzle } from "@repo/drizzle";
import { and, desc, eq, sql } from "drizzle-orm";
import type { InterestDto, ListQuery, SavedItemDto, SearchHistoryDto } from "../dto";
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

  /**
   * 저장 항목 단건 조회 (FR-002 / BBR-725).
   *
   * Owner scope is enforced in the WHERE clause (`id = :id AND user_id = :userId`):
   * a saved item that does not exist *or* belongs to another user resolves to the
   * exact same empty result, which we surface as 404. We deliberately do not
   * distinguish "not found" from "not yours" (no 403) so the endpoint never
   * leaks whether another user's id exists — 타인 항목은 존재 여부조차 노출하지
   * 않는다.
   */
  async getSavedItem(userId: string, id: string): Promise<SavedItemDto> {
    const [row] = await this.db
      .select()
      .from(savedItem)
      .where(and(eq(savedItem.id, id), eq(savedItem.userId, userId)))
      .limit(1);

    if (!row) {
      throw new NotFoundException("저장 항목을 찾을 수 없습니다.");
    }

    return toSavedItemDto(row);
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
