import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { asc, desc } from "drizzle-orm";

/**
 * Shared `sortBy` resolver for every story list query. Each domain's list
 * (worlds / characters / locations / factions / codex / drafts) re-uses the
 * same name/modified/created triad. Keeping the dispatch in one place removes
 * 6 nearly-identical private methods from `story.service.ts` and makes the
 * sort contract a single source of truth.
 */
export type SortBy = "latest" | "name" | "modified";

export interface SortColumns {
  /** Column used by `sortBy: "name"` (e.g. `name` for lore, `title` for drafts). */
  name: AnyPgColumn;
  /** Column used by `sortBy: "modified"`. */
  updatedAt: AnyPgColumn;
  /** Column used as the default (DESC). */
  createdAt: AnyPgColumn;
}

export function resolveOrderBy(cols: SortColumns, sortBy: SortBy | undefined) {
  if (sortBy === "name") return asc(cols.name);
  if (sortBy === "modified") return desc(cols.updatedAt);
  return desc(cols.createdAt);
}
