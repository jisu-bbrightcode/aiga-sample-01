/**
 * 통합검색 request DTOs (FR-003 / BBR-531).
 *
 * zod-first via `createZodDto`, matching the repo feature pattern. Every query
 * is validated + coerced at the HTTP boundary before it reaches the service.
 *
 * Filter separation by permission tier (acceptance criteria):
 * - public/user search: NO `isPublished` control — the service forces
 *   `isPublished = true`. Callers may only narrow by type/region/specialty.
 * - admin search: adds the `published` filter so an editor can target
 *   unpublished documents; omitting it returns published + unpublished.
 */
import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";

/** Search index entity types (mirrors `service_search_entity_type`). */
export const SEARCH_ENTITY_TYPES = ["doctor", "hospital", "specialty", "region"] as const;
const entityType = z.enum(SEARCH_ENTITY_TYPES);

const sortMode = z.enum(["relevance", "rating", "featured"]);

const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const sharedFilters = {
  q: z.string().trim().min(1).max(120).optional(),
  type: entityType.optional(),
  regionId: z.string().uuid().optional(),
  specialtyId: z.string().uuid().optional(),
  sort: sortMode.optional(),
};

// ---- public / user unified search ------------------------------------------

export const searchQuerySchema = pageQuerySchema.extend(sharedFilters);
export class SearchQueryDto extends createZodDto(searchQuerySchema) {}

// ---- admin unified search (adds publish-state filter) ----------------------

export const adminSearchQuerySchema = pageQuerySchema.extend({
  ...sharedFilters,
  /** Restrict to published (true) or unpublished (false). Omit for both. */
  published: z.coerce.boolean().optional(),
  /** Include archived (soft-deleted) documents. Default false — 노출 차단. */
  includeDeleted: z.coerce.boolean().optional(),
});
export class AdminSearchQueryDto extends createZodDto(adminSearchQuerySchema) {}

// ---- popular terms (public aggregate) --------------------------------------

export const popularQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(10),
  /** Lookback window in days for the popularity aggregate. */
  days: z.coerce.number().int().min(1).max(90).default(7),
});
export class PopularQueryDto extends createZodDto(popularQuerySchema) {}

// ---- recent terms (signed-in user's own history) ---------------------------

export const recentQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(10),
});
export class RecentQueryDto extends createZodDto(recentQuerySchema) {}
