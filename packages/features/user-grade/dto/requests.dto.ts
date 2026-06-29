/**
 * FR-001 사용자 — user-grade request DTOs (PB-FEAT-FR001-API-CREATE / BBR-528).
 *
 * Request validation is zod-first via `createZodDto`, matching the repo's
 * existing feature pattern (see service-domain/blog dto). Every admin mutation
 * is validated at the boundary before it reaches the service.
 */
import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";

/** Grade-determination provenance — mirrors `user_grade_source` pg enum. */
export const USER_GRADE_SOURCES = ["signup", "identity_verified", "manual", "system"] as const;

// ---- assign (create) a user's grade ----------------------------------------

/**
 * Assign a grade to a user. Exactly one of `gradeSlug` / `gradeId` is required
 * (slug is the ergonomic key, e.g. "verified"; id is the catalog uuid).
 * `source` defaults to `manual` at the service layer for admin assignment.
 */
export const assignUserGradeSchema = z
  .object({
    gradeSlug: z.string().trim().min(1).max(60).optional(),
    gradeId: z.string().uuid().optional(),
    source: z.enum(USER_GRADE_SOURCES).optional(),
    note: z.string().trim().max(1000).optional(),
    expiresAt: z.coerce.date().optional(),
  })
  .refine((d) => Boolean(d.gradeSlug) || Boolean(d.gradeId), {
    message: "gradeSlug 또는 gradeId 중 하나는 필수입니다.",
    path: ["gradeSlug"],
  });
export class AssignUserGradeDto extends createZodDto(assignUserGradeSchema) {}

// ---- list query ------------------------------------------------------------

export const listUserGradesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  gradeSlug: z.string().trim().min(1).max(60).optional(),
});
export class ListUserGradesQueryDto extends createZodDto(listUserGradesQuerySchema) {}
