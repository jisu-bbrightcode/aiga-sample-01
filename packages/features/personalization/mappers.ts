/**
 * Row → wire mappers for personalization lists (FR-002 / BBR-724).
 *
 * These lists return the *owner's own* records, so there is no public/admin
 * field separation to enforce — but we still go through explicit mappers so the
 * internal `userId` column never leaks onto the wire (the owner is implied by
 * the authenticated session) and timestamps are serialized as ISO strings.
 */

import type { InterestDto, SavedItemDto, SearchHistoryDto } from "./dto";
import type { Interest, SavedItem, SearchHistory } from "./schema";

export function toSavedItemDto(row: SavedItem): SavedItemDto {
  return {
    id: row.id,
    targetType: row.targetType,
    targetId: row.targetId,
    memo: row.memo ?? null,
    tags: row.tags ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toInterestDto(row: Interest): InterestDto {
  return {
    id: row.id,
    targetType: row.targetType,
    targetId: row.targetId,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toSearchHistoryDto(row: SearchHistory): SearchHistoryDto {
  return {
    id: row.id,
    query: row.query,
    filters: row.filters ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
