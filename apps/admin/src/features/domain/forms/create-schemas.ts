/**
 * Domain resource create — form validation schemas
 * (PB-ADMIN-DOMAIN-CREATE-001 / BBR-680).
 *
 * AC#1 — 필수 운영 필드와 공개 필드 validation이 분리되어 있다: the public
 * fields (what eventually appears on the published service) and the operational
 * fields (lifecycle status, 노출/추천, internal-only identifiers and notes) are
 * defined as two separate, independently-validated zod schemas per resource
 * type. The create form renders them as two sections and validates each on its
 * own before composing the request body. These mirror the server-side
 * `CreateDoctorDto` / `CreateHospitalDto` so a payload that passes here passes
 * the backend boundary too.
 */
import { z } from "zod";

const slug = z
  .string()
  .min(1, "slug를 입력해주세요.")
  .max(200)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug는 소문자/숫자/하이픈만 사용할 수 있습니다.");

const optionalUrl = z.string().url("올바른 URL을 입력해주세요.");

/** Lifecycle status — a new record defaults to draft (검수 전 저장). */
export const createStatusSchema = z.enum(["draft", "published", "archived"]);
export type CreateStatus = z.infer<typeof createStatusSchema>;

// ---------------------------------------------------------------------------
// 의사 (doctor)
// ---------------------------------------------------------------------------

/** 공개 필드 — surfaces on the published 의사 profile. */
export const doctorPublicSchema = z.object({
  name: z.string().min(1, "이름을 입력해주세요.").max(120),
  slug,
  title: z.string().max(120).optional(),
  regionId: z.string().uuid().optional(),
  primarySpecialtyId: z.string().uuid().optional(),
  shortBio: z.string().max(2000).optional(),
  photoUrl: optionalUrl.optional(),
  yearsExperience: z.number().int().min(0).max(100).optional(),
});
export type DoctorPublicInput = z.infer<typeof doctorPublicSchema>;

/** 운영 필드 — admin-only lifecycle / 노출 / 내부 식별·메모. */
export const doctorOperationsSchema = z.object({
  status: createStatusSchema.default("draft"),
  isFeatured: z.boolean().optional(),
  licenseNumber: z.string().max(64).optional(),
  sourceUrl: optionalUrl.optional(),
  internalNotes: z.string().optional(),
});
export type DoctorOperationsInput = z.infer<typeof doctorOperationsSchema>;

export const doctorCreateSchema = doctorPublicSchema.merge(doctorOperationsSchema);
export type DoctorCreateInput = z.infer<typeof doctorCreateSchema>;

// ---------------------------------------------------------------------------
// 병원 (hospital)
// ---------------------------------------------------------------------------

/** 공개 필드 — surfaces on the published 병원 page. */
export const hospitalPublicSchema = z.object({
  name: z.string().min(1, "병원명을 입력해주세요.").max(200),
  slug,
  regionId: z.string().uuid().optional(),
  summary: z.string().max(2000).optional(),
  addressLine: z.string().max(300).optional(),
  phone: z.string().max(40).optional(),
  websiteUrl: optionalUrl.optional(),
  photoUrl: optionalUrl.optional(),
});
export type HospitalPublicInput = z.infer<typeof hospitalPublicSchema>;

/** 운영 필드 — admin-only lifecycle / 노출 / 내부 식별·메모. */
export const hospitalOperationsSchema = z.object({
  status: createStatusSchema.default("draft"),
  isFeatured: z.boolean().optional(),
  businessRegistrationNo: z.string().max(32).optional(),
  sourceUrl: optionalUrl.optional(),
  internalNotes: z.string().optional(),
});
export type HospitalOperationsInput = z.infer<typeof hospitalOperationsSchema>;

export const hospitalCreateSchema = hospitalPublicSchema.merge(hospitalOperationsSchema);
export type HospitalCreateInput = z.infer<typeof hospitalCreateSchema>;
