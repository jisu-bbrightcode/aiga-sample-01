/**
 * Service-domain response DTOs.
 *
 * These shape the OpenAPI contract (single source of truth = NestJS Swagger).
 * Public DTOs mirror the public mapper output exactly — the sensitive columns
 * (license/business numbers, internal notes, provenance, editor ids,
 * soft-delete bookkeeping) are intentionally absent from the public schemas.
 */
import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";
import { SERVICE_PUBLISH_STATUSES } from "../status";

// ---- taxonomy ---------------------------------------------------------------

export const publicSpecialtySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  sortOrder: z.number(),
});
export class PublicSpecialtyDto extends createZodDto(publicSpecialtySchema) {}

export const publicRegionSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  parentId: z.string().nullable(),
  sortOrder: z.number(),
});
export class PublicRegionDto extends createZodDto(publicRegionSchema) {}

// ---- hospital ---------------------------------------------------------------

export const publicHospitalSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  summary: z.string().nullable(),
  description: z.string().nullable(),
  regionId: z.string().nullable(),
  addressLine: z.string().nullable(),
  phone: z.string().nullable(),
  websiteUrl: z.string().nullable(),
  photoUrl: z.string().nullable(),
  ratingAvg: z.number(),
  reviewCount: z.number(),
  isFeatured: z.boolean(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export class PublicHospitalDto extends createZodDto(publicHospitalSchema) {}

// ---- doctor -----------------------------------------------------------------

export const publicDoctorSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  title: z.string().nullable(),
  primarySpecialtyId: z.string().nullable(),
  primaryHospitalId: z.string().nullable(),
  regionId: z.string().nullable(),
  shortBio: z.string().nullable(),
  biography: z.string().nullable(),
  photoUrl: z.string().nullable(),
  yearsExperience: z.number().nullable(),
  ratingAvg: z.number(),
  reviewCount: z.number(),
  isFeatured: z.boolean(),
  featuredRank: z.number().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export class PublicDoctorDto extends createZodDto(publicDoctorSchema) {}

/** Doctor detail = public doctor + resolved hub relations (all public-mapped). */
export const publicDoctorDetailSchema = publicDoctorSchema.extend({
  region: publicRegionSchema.nullable(),
  specialties: z.array(publicSpecialtySchema),
  hospitals: z.array(
    z.object({
      hospital: publicHospitalSchema,
      role: z.string().nullable(),
      isPrimary: z.boolean(),
    }),
  ),
});
export class PublicDoctorDetailDto extends createZodDto(publicDoctorDetailSchema) {}

/** Hospital detail = public hospital + region + affiliated published doctors. */
export const publicHospitalDetailSchema = publicHospitalSchema.extend({
  region: publicRegionSchema.nullable(),
  doctors: z.array(publicDoctorSchema),
});
export class PublicHospitalDetailDto extends createZodDto(publicHospitalDetailSchema) {}

// ---- paginated envelopes ----------------------------------------------------

const pageMeta = { total: z.number(), page: z.number(), limit: z.number() };

export const doctorListSchema = z.object({
  items: z.array(publicDoctorSchema),
  ...pageMeta,
});
export class DoctorListDto extends createZodDto(doctorListSchema) {}

export const hospitalListSchema = z.object({
  items: z.array(publicHospitalSchema),
  ...pageMeta,
});
export class HospitalListDto extends createZodDto(hospitalListSchema) {}

// ---- admin ------------------------------------------------------------------

const statusEnum = z.enum(SERVICE_PUBLISH_STATUSES);

/**
 * Admin views expose the full editorial row including sensitive columns, since
 * the route is gated by NestAdminGuard. `.passthrough()` keeps any column not
 * enumerated here (e.g. future additions) while still publishing a concrete
 * OpenAPI shape for the audited fields.
 */
export const adminDoctorSchema = publicDoctorSchema
  .extend({
    status: statusEnum,
    licenseNumber: z.string().nullable(),
    licenseVerifiedAt: z.string().nullable(),
    internalNotes: z.string().nullable(),
    sourceUrl: z.string().nullable(),
    publishedAt: z.string().nullable(),
    createdBy: z.string().nullable(),
    updatedBy: z.string().nullable(),
    deletedAt: z.string().nullable(),
    isDeleted: z.boolean(),
  })
  .passthrough();
export class AdminDoctorDto extends createZodDto(adminDoctorSchema) {}

export const adminHospitalSchema = publicHospitalSchema
  .extend({
    status: statusEnum,
    businessRegistrationNo: z.string().nullable(),
    internalNotes: z.string().nullable(),
    sourceUrl: z.string().nullable(),
    publishedAt: z.string().nullable(),
    createdBy: z.string().nullable(),
    updatedBy: z.string().nullable(),
    deletedAt: z.string().nullable(),
    isDeleted: z.boolean(),
  })
  .passthrough();
export class AdminHospitalDto extends createZodDto(adminHospitalSchema) {}

// ---- admin paginated envelopes ----------------------------------------------
//
// Same `{ items, total, page, limit }` shape as the public lists, but the items
// carry the full admin projection. This is the admin tier of the public/admin
// field separation required by FR-005-API-LIST (BBR-541).

export const adminDoctorListSchema = z.object({
  items: z.array(adminDoctorSchema),
  ...pageMeta,
});
export class AdminDoctorListDto extends createZodDto(adminDoctorListSchema) {}

export const adminHospitalListSchema = z.object({
  items: z.array(adminHospitalSchema),
  ...pageMeta,
});
export class AdminHospitalListDto extends createZodDto(adminHospitalListSchema) {}

export const deleteResultSchema = z.object({ success: z.boolean(), id: z.string() });
export class DeleteResultDto extends createZodDto(deleteResultSchema) {}
