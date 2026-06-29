/**
 * Cursor pagination for owner-scoped personalization lists
 * (FR-002 / BBR-724).
 *
 * Keyset on `(created_at, id)` descending — newest first, with `id` as a stable
 * tiebreaker so rows sharing a `created_at` are never skipped or duplicated
 * across pages. The cursor is an opaque base64url token; clients pass it back
 * verbatim and never construct it. An unparseable/invalid token is treated as
 * "no cursor" (first page) rather than an error, so a stale token degrades
 * gracefully instead of 400-ing the caller.
 */

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface CursorPayload {
  /** ISO timestamp of the last row on the page. */
  createdAt: string;
  /** Id of the last row on the page (tiebreaker). */
  id: string;
}

/** Encode the last row of a page into an opaque forward cursor. */
export function encodeCursor(createdAt: Date, id: string): string {
  const payload: CursorPayload = { createdAt: createdAt.toISOString(), id };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

/**
 * Decode a client cursor. Returns null for anything that is not a structurally
 * valid `{ createdAt: ISO, id }` token so the caller falls back to page one.
 */
export function decodeCursor(cursor: string | undefined | null): CursorPayload | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as CursorPayload).createdAt === "string" &&
      typeof (parsed as CursorPayload).id === "string" &&
      !Number.isNaN(Date.parse((parsed as CursorPayload).createdAt))
    ) {
      const { createdAt, id } = parsed as CursorPayload;
      return { createdAt, id };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Turn a `limit + 1` row fetch into a page + next cursor. The extra row (if
 * present) signals "there is more" and is dropped from the returned items.
 */
export function buildCursorPage<T extends { createdAt: Date; id: string }>(
  rows: T[],
  limit: number,
): CursorPage<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return {
    items,
    nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
  };
}
