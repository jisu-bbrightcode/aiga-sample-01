/**
 * User-directory request DTOs.
 *
 * Validation is zod-first via `createZodDto`, matching the repo feature
 * pattern (service-domain/dto). Query params arrive as strings, so numeric /
 * boolean filters use `z.coerce` and are validated at the boundary.
 *
 * Public and admin list queries are intentionally separate DTOs: the public
 * surface accepts only safe filters (text search + grade + sort), while the
 * admin surface adds operational filters (활성여부/인증수단/삭제포함).
 */
import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";

const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** Search term — matched against name/handle (and email for admin). */
const q = z.string().trim().min(1).max(120).optional();

/** Grade filter by stable slug (e.g. "verified", "premium"). */
const gradeSlug = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .regex(/^[a-z0-9-]+$/, "등급 slug는 소문자/숫자/하이픈만 사용할 수 있습니다.")
  .optional();

// ---- public member directory -----------------------------------------------

export const listUsersQuerySchema = pageQuerySchema.extend({
  q,
  grade: gradeSlug,
  sort: z.enum(["recent", "name"]).default("recent"),
});
export class ListUsersQueryDto extends createZodDto(listUsersQuerySchema) {}

// ---- admin user management --------------------------------------------------

export const listAdminUsersQuerySchema = pageQuerySchema.extend({
  q,
  grade: gradeSlug,
  authProvider: z.enum(["email", "google", "naver", "kakao", "linkedin"]).optional(),
  isActive: z.coerce.boolean().optional(),
  includeDeleted: z.coerce.boolean().default(false),
  sort: z.enum(["recent", "name", "email"]).default("recent"),
});
export class ListAdminUsersQueryDto extends createZodDto(listAdminUsersQuerySchema) {}
