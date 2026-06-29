/**
 * 명의 큐레이션 response DTOs — FR-004 (BBR-538).
 *
 * These shape the OpenAPI contract (single source of truth = NestJS Swagger).
 * The admin DTO carries the full record; the public DTO is intentionally
 * missing the admin-only columns (status, internalNotes, sourceUrl, editor ids,
 * publishedAt, soft-delete bookkeeping) so the contract matches the mapper.
 */
import { serviceCollectionKindEnum, servicePublishStatusEnum } from "@repo/drizzle/schema";
import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";
import { publicDoctorSchema } from "../../service-domain/dto";

const kind = z.enum(serviceCollectionKindEnum.enumValues);
const status = z.enum(servicePublishStatusEnum.enumValues);

// ---- public -----------------------------------------------------------------

export const publicCollectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  subtitle: z.string().nullable(),
  description: z.string().nullable(),
  heroImageUrl: z.string().nullable(),
  kind,
  specialtyId: z.string().nullable(),
  regionId: z.string().nullable(),
  isFeatured: z.boolean(),
  sortOrder: z.number(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export class PublicCollectionDto extends createZodDto(publicCollectionSchema) {}

// ---- collection item --------------------------------------------------------

export const collectionItemSchema = z.object({
  doctorId: z.string(),
  rank: z.number(),
  note: z.string().nullable(),
  createdAt: z.string().nullable(),
});

// ---- admin ------------------------------------------------------------------

export const adminCollectionSchema = publicCollectionSchema.extend({
  status,
  internalNotes: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  publishedAt: z.string().nullable(),
  createdBy: z.string().nullable(),
  updatedBy: z.string().nullable(),
  isDeleted: z.boolean(),
  deletedAt: z.string().nullable(),
});
export class AdminCollectionDto extends createZodDto(adminCollectionSchema) {}

export const adminCollectionDetailSchema = adminCollectionSchema.extend({
  items: z.array(collectionItemSchema),
});
export class AdminCollectionDetailDto extends createZodDto(adminCollectionDetailSchema) {}

// ---- admin list -------------------------------------------------------------

export const adminCollectionListSchema = z.object({
  items: z.array(adminCollectionSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
});
export class AdminCollectionListDto extends createZodDto(adminCollectionListSchema) {}

// ---- public list / detail (FR-004 / BBR-536) -------------------------------

/** Public list envelope — published collections, public projection only. */
export const collectionListSchema = z.object({
  items: z.array(publicCollectionSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
});
export class CollectionListDto extends createZodDto(collectionListSchema) {}

/** Public 수록 의사 entry — rank/note + the embedded public-mapped doctor. */
export const publicCollectionItemSchema = z.object({
  rank: z.number(),
  note: z.string().nullable(),
  doctor: publicDoctorSchema,
});

/** Public detail = public collection + ranked published 수록 의사. */
export const publicCollectionDetailSchema = publicCollectionSchema.extend({
  items: z.array(publicCollectionItemSchema),
});
export class PublicCollectionDetailDto extends createZodDto(publicCollectionDetailSchema) {}
