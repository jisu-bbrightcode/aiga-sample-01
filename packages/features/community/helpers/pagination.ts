// ============================================================================
// Cursor Pagination Utilities
// ============================================================================

/**
 * Cursor-based pagination result
 */
export interface CursorPaginationResult<T> {
  items: T[];
  nextCursor: string | null;
}

// base64url helpers (isomorphic: Node.js + Browser)
function toBase64Url(str: string): string {
  const base64 = btoa(str);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(str: string): string {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  return atob(base64);
}

/**
 * Encode cursor (base64url)
 */
export function encodeCursor(value: string, id: string): string {
  return toBase64Url(JSON.stringify({ v: value, id }));
}

/**
 * Decode cursor
 */
export function decodeCursor(cursor: string): { value: string; id: string } | null {
  try {
    const parsed = JSON.parse(fromBase64Url(cursor));
    if (typeof parsed.v === "string" && typeof parsed.id === "string") {
      return { value: parsed.v, id: parsed.id };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Build cursor pagination result from limit+1 query
 */
export function buildCursorResult<T>(
  items: T[],
  limit: number,
  cursorExtractor: (item: T) => { value: string; id: string },
): CursorPaginationResult<T> {
  const hasMore = items.length > limit;
  const result = hasMore ? items.slice(0, limit) : items;

  let nextCursor: string | null = null;
  if (hasMore && result.length > 0) {
    const last = result[result.length - 1]!;
    const { value, id } = cursorExtractor(last);
    nextCursor = encodeCursor(value, id);
  }

  return { items: result, nextCursor };
}
