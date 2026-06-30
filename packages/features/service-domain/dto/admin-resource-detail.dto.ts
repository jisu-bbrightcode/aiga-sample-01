/**
 * Admin domain resource DETAIL DTOs (PB-ADMIN-DOMAIN-READ-001 / BBR-679).
 *
 * The read-one response for the admin detail screen. It carries the full
 * operational state of a catalog record plus its related entities. Sensitive
 * identifiers are present only in their masked form (see `admin-resource-detail`
 * `maskSecret`); the raw 면허번호/사업자등록번호 never appears in this schema.
 */
import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";
import { ADMIN_DOMAIN_RESOURCE_TYPES } from "../admin-resources";
import { SERVICE_PUBLISH_STATUSES } from "../status";

// ---- path params ------------------------------------------------------------

export const adminDomainResourceDetailParamSchema = z.object({
  type: z.enum(ADMIN_DOMAIN_RESOURCE_TYPES),
  id: z.string().uuid(),
});
export class AdminDomainResourceDetailParamDto extends createZodDto(
  adminDomainResourceDetailParamSchema,
) {}

// ---- shared sub-shapes ------------------------------------------------------

const statusSchema = z.enum(SERVICE_PUBLISH_STATUSES);

const regionRefSchema = z.object({ id: z.string(), name: z.string(), slug: z.string() }).nullable();

const specialtyRefSchema = z.object({ id: z.string(), name: z.string(), slug: z.string() });

const resourceRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  status: statusSchema,
});

const affiliationRefSchema = resourceRefSchema.extend({
  role: z.string().nullable(),
  isPrimary: z.boolean(),
});

const opsSchema = z.object({
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  publishedAt: z.string().nullable(),
  isDeleted: z.boolean(),
  deletedAt: z.string().nullable(),
  createdBy: z.string().nullable(),
  updatedBy: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  internalNotes: z.string().nullable(),
});

const credentialViewSchema = z.object({
  id: z.string(),
  kind: z.string(),
  title: z.string(),
  organization: z.string().nullable(),
  displayPeriod: z.string().nullable(),
  startYear: z.number().nullable(),
  endYear: z.number().nullable(),
  isVisible: z.boolean(),
  sortOrder: z.number(),
});

const hoursViewSchema = z.object({
  id: z.string(),
  dayOfWeek: z.number(),
  opensAt: z.string().nullable(),
  closesAt: z.string().nullable(),
  isClosed: z.boolean(),
  note: z.string().nullable(),
});

const baseFields = {
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  status: statusSchema,
  isFeatured: z.boolean(),
  photoUrl: z.string().nullable(),
  ratingAvg: z.number(),
  reviewCount: z.number(),
  region: regionRefSchema,
  ops: opsSchema,
};

/**
 * Response schema for the admin detail endpoint.
 *
 * Modeled as a single object whose type-specific fields are optional rather
 * than a `z.discriminatedUnion` because `createZodDto` requires an object
 * metatype to derive its DTO class (a union has no statically-known members).
 * The actual runtime payload is the precise `AdminDomainResourceDetail`
 * discriminated union from `admin-resource-detail.ts`; this schema documents
 * the superset of fields and keeps the sensitive identifiers masked-only.
 */
export const adminDomainResourceDetailSchema = z.object({
  ...baseFields,
  type: z.enum(ADMIN_DOMAIN_RESOURCE_TYPES),
  // 의사 (type === "doctor")
  title: z.string().nullable().optional(),
  yearsExperience: z.number().nullable().optional(),
  featuredRank: z.number().nullable().optional(),
  shortBio: z.string().nullable().optional(),
  biography: z.string().nullable().optional(),
  primarySpecialty: specialtyRefSchema.nullable().optional(),
  hospitals: z.array(affiliationRefSchema).optional(),
  credentials: z.array(credentialViewSchema).optional(),
  licenseVerifiedAt: z.string().nullable().optional(),
  // 병원 (type === "hospital")
  summary: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  addressLine: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  websiteUrl: z.string().nullable().optional(),
  doctors: z.array(resourceRefSchema).optional(),
  hours: z.array(hoursViewSchema).optional(),
  // shared between both types
  specialties: z.array(specialtyRefSchema).optional(),
  // sensitive identifiers — only ever their masked form
  sensitive: z.object({
    licenseNumber: z.string().nullable().optional(),
    businessRegistrationNo: z.string().nullable().optional(),
  }),
});

export class AdminDomainResourceDetailDto extends createZodDto(adminDomainResourceDetailSchema) {}
