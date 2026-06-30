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
// Reuse the self-service handle rules (format + reserved words) so an admin
// edit validates handles identically to the user's own settings flow.
import { handleSchema } from "../../_common/dto/common-settings.dto";

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

// ---- admin archive / restore (soft delete) ----------------------------------

/**
 * Optional operator note recorded in the audit log when a user is
 * archived (soft-deleted) or restored. The action itself targets the user by
 * path id; the body only carries the audit reason, so both endpoints reuse it.
 */
export const archiveUserBodySchema = z.object({
  reason: z.string().trim().max(500).optional(),
});
export class ArchiveUserBodyDto extends createZodDto(archiveUserBodySchema) {}

// ---- admin in-place update / status change (BBR-529) ------------------------

/** Optional operator note recorded in `admin_audit_log` for an edit/status change. */
const auditReason = z.string().trim().max(500).optional();

/**
 * 관리자 부분 수정 body. 허용 필드만 노출하며 전부 optional(부분 업데이트).
 * nullable 필드(handle/bio/avatar)는 `null` 로 비울 수 있다. handle 은 self 설정과
 * 동일한 규칙(`_common` handleSchema: 소문자/숫자/하이픈 + 예약어 차단)을 재사용한다.
 * email/인증수단/등급/활성여부/삭제부기는 이 스키마에 없으므로 수정 대상이 아니다.
 */
export const updateAdminUserSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  handle: handleSchema.nullable().optional(),
  bio: z.string().trim().max(500).nullable().optional(),
  avatar: z.string().trim().url().max(2048).nullable().optional(),
  reason: auditReason,
});
export class UpdateAdminUserDto extends createZodDto(updateAdminUserSchema) {}

/** 변경 이력 조회 쿼리(admin_audit_log cursor 페이지네이션). */
export const userHistoryQuerySchema = z.object({
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});
export class UserHistoryQueryDto extends createZodDto(userHistoryQuerySchema) {}
