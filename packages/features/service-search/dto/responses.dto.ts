/**
 * 통합검색 response DTOs (FR-003 / BBR-531).
 *
 * These shape the OpenAPI contract (single source of truth = NestJS Swagger).
 * The public hit schema mirrors `toPublicSearchHit` exactly — index internals
 * (body/keywords/weight/isPublished/sourceUpdatedAt) are intentionally absent;
 * they appear only on the admin schema.
 */
import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";
import { SEARCH_ENTITY_TYPES } from "./requests.dto";

const entityType = z.enum(SEARCH_ENTITY_TYPES);

const pageMeta = { total: z.number(), page: z.number(), limit: z.number() };

// ---- public hit + list -----------------------------------------------------

export const publicSearchHitSchema = z.object({
  entityType,
  entityId: z.string(),
  title: z.string(),
  subtitle: z.string().nullable(),
  slug: z.string(),
  photoUrl: z.string().nullable(),
  regionId: z.string().nullable(),
  specialtyId: z.string().nullable(),
  ratingAvg: z.number(),
});
export class PublicSearchHitDto extends createZodDto(publicSearchHitSchema) {}

export const searchResultSchema = z.object({
  items: z.array(publicSearchHitSchema),
  ...pageMeta,
});
export class SearchResultDto extends createZodDto(searchResultSchema) {}

// ---- admin hit + list ------------------------------------------------------

export const adminSearchHitSchema = publicSearchHitSchema.extend({
  id: z.string(),
  body: z.string().nullable(),
  keywords: z.string().nullable(),
  weight: z.number(),
  isPublished: z.boolean(),
  sourceUpdatedAt: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export class AdminSearchHitDto extends createZodDto(adminSearchHitSchema) {}

export const adminSearchResultSchema = z.object({
  items: z.array(adminSearchHitSchema),
  ...pageMeta,
});
export class AdminSearchResultDto extends createZodDto(adminSearchResultSchema) {}

// ---- popular (public aggregate) --------------------------------------------

export const popularTermSchema = z.object({
  term: z.string(),
  count: z.number(),
});
export class PopularTermDto extends createZodDto(popularTermSchema) {}

// ---- recent (user's own history) -------------------------------------------

export const recentSearchSchema = z.object({
  term: z.string(),
  lastSearchedAt: z.string(),
});
export class RecentSearchDto extends createZodDto(recentSearchSchema) {}
