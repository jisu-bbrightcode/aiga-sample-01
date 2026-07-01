/**
 * Service-domain request DTOs.
 *
 * Request validation is zod-first via `createZodDto`, matching the repo's
 * existing feature pattern (see blog/dto). Every admin mutation is validated
 * at the boundary before it reaches the service.
 */
import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";
import { SERVICE_PUBLISH_STATUSES } from "../status";

const slug = z
  .string()
  .min(1, "slug를 입력해주세요.")
  .max(200)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug는 소문자/숫자/하이픈만 사용할 수 있습니다.");

const statusEnum = z.enum(SERVICE_PUBLISH_STATUSES);

// ---- list / browse query ---------------------------------------------------

const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const listDoctorsQuerySchema = pageQuerySchema.extend({
  specialtyId: z.string().uuid().optional(),
  regionId: z.string().uuid().optional(),
  featured: z.coerce.boolean().optional(),
  q: z.string().trim().min(1).max(120).optional(),
});
export class ListDoctorsQueryDto extends createZodDto(listDoctorsQuerySchema) {}

export const listHospitalsQuerySchema = pageQuerySchema.extend({
  regionId: z.string().uuid().optional(),
  featured: z.coerce.boolean().optional(),
  q: z.string().trim().min(1).max(120).optional(),
});
export class ListHospitalsQueryDto extends createZodDto(listHospitalsQuerySchema) {}

export const listRegionsQuerySchema = z.object({
  parentId: z.string().uuid().optional(),
});
export class ListRegionsQueryDto extends createZodDto(listRegionsQuerySchema) {}

// ---- doctor create / update -------------------------------------------------

const doctorAffiliationSchema = z.object({
  hospitalId: z.string().uuid(),
  role: z.string().max(80).optional(),
  isPrimary: z.boolean().default(false),
});

export const createDoctorSchema = z.object({
  name: z.string().min(1, "이름을 입력해주세요.").max(120),
  slug,
  title: z.string().max(120).optional(),
  primarySpecialtyId: z.string().uuid().optional(),
  primaryHospitalId: z.string().uuid().optional(),
  regionId: z.string().uuid().optional(),
  shortBio: z.string().max(2000).optional(),
  biography: z.string().optional(),
  photoUrl: z.string().url().optional(),
  yearsExperience: z.number().int().min(0).max(100).optional(),
  isFeatured: z.boolean().optional(),
  featuredRank: z.number().int().min(0).optional(),
  status: statusEnum.default("draft"),
  // admin-only sensitive fields
  licenseNumber: z.string().max(64).optional(),
  internalNotes: z.string().optional(),
  sourceUrl: z.string().url().optional(),
  // associations (replace semantics when provided)
  specialtyIds: z.array(z.string().uuid()).max(20).optional(),
  hospitals: z.array(doctorAffiliationSchema).max(20).optional(),
});
export class CreateDoctorDto extends createZodDto(createDoctorSchema) {}

export const updateDoctorSchema = createDoctorSchema.partial();
export class UpdateDoctorDto extends createZodDto(updateDoctorSchema) {}

// ---- hospital create / update ----------------------------------------------

export const createHospitalSchema = z.object({
  name: z.string().min(1, "병원명을 입력해주세요.").max(200),
  slug,
  summary: z.string().max(2000).optional(),
  description: z.string().optional(),
  regionId: z.string().uuid().optional(),
  addressLine: z.string().max(300).optional(),
  phone: z.string().max(40).optional(),
  websiteUrl: z.string().url().optional(),
  photoUrl: z.string().url().optional(),
  isFeatured: z.boolean().optional(),
  status: statusEnum.default("draft"),
  // admin-only sensitive fields
  businessRegistrationNo: z.string().max(32).optional(),
  internalNotes: z.string().optional(),
  sourceUrl: z.string().url().optional(),
});
export class CreateHospitalDto extends createZodDto(createHospitalSchema) {}

export const updateHospitalSchema = createHospitalSchema.partial();
export class UpdateHospitalDto extends createZodDto(updateHospitalSchema) {}

// ---- doctor profile credential create (FR-005) ------------------------------

/** 의사 프로필 이력 종류 — mirrors the service_doctor_credential_kind enum. */
export const SERVICE_DOCTOR_CREDENTIAL_KINDS = [
  "education",
  "career",
  "certification",
  "award",
] as const;

const credentialYear = z.number().int().min(1900).max(2200);

export const createDoctorCredentialSchema = z.object({
  kind: z.enum(SERVICE_DOCTOR_CREDENTIAL_KINDS),
  title: z.string().min(1, "항목 제목을 입력해주세요.").max(200),
  organization: z.string().max(200).optional(),
  startYear: credentialYear.optional(),
  endYear: credentialYear.optional(),
  displayPeriod: z.string().max(80).optional(),
  description: z.string().optional(),
  sortOrder: z.number().int().min(0).default(0),
  // initial state: an entry is publicly visible unless the editor hides it.
  isVisible: z.boolean().default(true),
});
export class CreateDoctorCredentialDto extends createZodDto(createDoctorCredentialSchema) {}

// ---- hospital detail create (FR-005 / FR-006 병원 상세) ----------------------

export const createHospitalSpecialtySchema = z.object({
  specialtyId: z.string().uuid(),
  sortOrder: z.number().int().min(0).default(0),
});
export class CreateHospitalSpecialtyDto extends createZodDto(createHospitalSpecialtySchema) {}

const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "시간은 HH:MM 형식이어야 합니다.");

export const createHospitalHoursSchema = z.object({
  // 0 = Sunday … 6 = Saturday (JS getDay()).
  dayOfWeek: z.number().int().min(0).max(6),
  opensAt: timeOfDay.optional(),
  closesAt: timeOfDay.optional(),
  isClosed: z.boolean().default(false),
  note: z.string().max(120).optional(),
});
export class CreateHospitalHoursDto extends createZodDto(createHospitalHoursSchema) {}

// ---- status change ----------------------------------------------------------

export const changeStatusSchema = z.object({ status: statusEnum });
// Uniquely named so it does not collide with doctor-curation's ChangeStatusDto
// in the shared OpenAPI schema registry (schemas are keyed by class name).
export class ResourceChangeStatusDto extends createZodDto(changeStatusSchema) {}
