/**
 * FR-001 사용자 — user-grade response DTOs (PB-FEAT-FR001-API-CREATE / BBR-528).
 *
 * These shape the OpenAPI contract (single source of truth = NestJS Swagger).
 * Grade assignment carries admin/private provenance (source, determinedBy,
 * note); this resource is only ever served from the admin-gated controller,
 * so the response intentionally includes those fields.
 */
import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";
import { USER_GRADE_SOURCES } from "./requests.dto";

/** A user's current grade assignment, resolved against the grade catalog. */
export const adminUserGradeSchema = z.object({
  userId: z.string(),
  gradeId: z.string(),
  gradeSlug: z.string(),
  gradeName: z.string(),
  /** Daily protected-action quota for the grade. null = unlimited. */
  dailyUsageLimit: z.number().nullable(),
  source: z.enum(USER_GRADE_SOURCES),
  determinedBy: z.string().nullable(),
  note: z.string().nullable(),
  determinedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export class AdminUserGradeDto extends createZodDto(adminUserGradeSchema) {}

export const adminUserGradeListSchema = z.object({
  items: z.array(adminUserGradeSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
});
export class AdminUserGradeListDto extends createZodDto(adminUserGradeListSchema) {}
