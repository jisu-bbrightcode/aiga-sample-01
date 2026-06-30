/**
 * User-directory response DTOs.
 *
 * These shape the OpenAPI contract (single source of truth = NestJS Swagger)
 * and mirror the mapper output exactly. The public/self schemas intentionally
 * omit the sensitive columns (email is self+admin only; auth provider / active
 * flag / soft-delete bookkeeping / grade provenance / quota config are
 * admin-only).
 */
import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";

const gradeBadgeSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
});

// ---- public -----------------------------------------------------------------

export const publicUserSchema = z.object({
  id: z.string(),
  handle: z.string().nullable(),
  name: z.string(),
  bio: z.string().nullable(),
  avatar: z.string().nullable(),
  grade: gradeBadgeSchema.nullable(),
  joinedAt: z.string().nullable(),
});
export class PublicUserDto extends createZodDto(publicUserSchema) {}

// ---- public detail (viewer-aware, BBR-527) ----------------------------------

export const viewerStateSchema = z.object({
  authenticated: z.boolean(),
  isSelf: z.boolean(),
});

export const publicUserDetailSchema = publicUserSchema.extend({
  viewer: viewerStateSchema,
});
export class PublicUserDetailDto extends createZodDto(publicUserDetailSchema) {}

// ---- self -------------------------------------------------------------------

export const selfUserSchema = publicUserSchema.extend({
  email: z.string(),
  authProvider: z.string().nullable(),
  isActive: z.boolean(),
  marketingConsentAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export class SelfUserDto extends createZodDto(selfUserSchema) {}

// ---- admin ------------------------------------------------------------------

const adminGradeDetailSchema = gradeBadgeSchema.extend({
  dailyUsageLimit: z.number().nullable(),
  source: z.string().nullable(),
  determinedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
});

export const adminUserSchema = z.object({
  id: z.string(),
  handle: z.string().nullable(),
  name: z.string(),
  email: z.string(),
  bio: z.string().nullable(),
  avatar: z.string().nullable(),
  authProvider: z.string().nullable(),
  isActive: z.boolean(),
  grade: adminGradeDetailSchema.nullable(),
  marketingConsentAt: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  deletedAt: z.string().nullable(),
});
export class AdminUserDto extends createZodDto(adminUserSchema) {}

// ---- paginated envelopes ----------------------------------------------------

const pageMeta = { total: z.number(), page: z.number(), limit: z.number() };

export const userListSchema = z.object({ items: z.array(publicUserSchema), ...pageMeta });
export class UserListDto extends createZodDto(userListSchema) {}

export const adminUserListSchema = z.object({ items: z.array(adminUserSchema), ...pageMeta });
export class AdminUserListDto extends createZodDto(adminUserListSchema) {}
