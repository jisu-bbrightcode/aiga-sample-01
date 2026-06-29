import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";

/**
 * Query / response contracts for the file listing endpoints
 * (PB-FILE-API-LIST-001 / BBR-550).
 *
 * - `GET /files` — the authenticated owner lists their own files.
 * - `GET /admin/files` — an operator lists every file with full filters.
 *
 * Exposure policy (acceptance criteria §3) is enforced in the service, not here:
 * soft-deleted (`status="deleted"`) assets are never returned to owners and are
 * hidden from admins unless `includeDeleted=true` is requested explicitly.
 */

/** Page-based pagination shared by both listings (mirrors service-domain). */
const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** Lifecycle states an owner may filter by — `deleted` is intentionally absent. */
const ownerStatusEnum = z.enum(["pending", "ready", "failed"]);
/** Admin may additionally inspect `deleted` rows. */
const adminStatusEnum = z.enum(["pending", "ready", "failed", "deleted"]);
const visibilityEnum = z.enum(["public", "private"]);
const sourceEnum = z.enum(["user", "admin", "system"]);

/**
 * `GET /files` query — the owner's own files only. Every filter is scoped to the
 * caller server-side; there is no `ownerUserId` filter the caller can set.
 */
export const listOwnFilesQuerySchema = pageQuerySchema.extend({
  status: ownerStatusEnum.optional(),
  visibility: visibilityEnum.optional(),
  targetType: z.string().trim().min(1).max(64).optional(),
  targetId: z.string().trim().min(1).max(255).optional(),
  contentType: z.string().trim().min(1).max(255).optional(),
});
export type ListOwnFilesQuery = z.infer<typeof listOwnFilesQuerySchema>;
export class ListOwnFilesQueryDto extends createZodDto(listOwnFilesQuerySchema) {}

/**
 * `GET /admin/files` query — operator console filters (acceptance criteria §2):
 * owner, target, status, visibility, MIME type, plus source and an explicit
 * `includeDeleted` toggle for the consistent deletion-exposure policy (§3).
 */
export const listAdminFilesQuerySchema = pageQuerySchema.extend({
  ownerUserId: z.string().trim().min(1).max(255).optional(),
  source: sourceEnum.optional(),
  status: adminStatusEnum.optional(),
  visibility: visibilityEnum.optional(),
  targetType: z.string().trim().min(1).max(64).optional(),
  targetId: z.string().trim().min(1).max(255).optional(),
  contentType: z.string().trim().min(1).max(255).optional(),
  /** Include soft-deleted rows. Default false → deleted files stay hidden. */
  includeDeleted: z.coerce.boolean().optional().default(false),
});
export type ListAdminFilesQuery = z.infer<typeof listAdminFilesQuerySchema>;
export class ListAdminFilesQueryDto extends createZodDto(listAdminFilesQuerySchema) {}

/** Paginated envelope `{ items, total, page, limit }`. */
function pageOpenApiSchema(itemSchema: Record<string, unknown>) {
  return {
    type: "object",
    required: ["items", "total", "page", "limit"],
    properties: {
      items: { type: "array", items: itemSchema },
      total: { type: "integer", description: "Total rows matching the filter" },
      page: { type: "integer" },
      limit: { type: "integer" },
    },
  };
}

/**
 * Owner-facing file view — the uploader's own metadata. Excludes internal
 * fields (storage pathname, scan/review/declared columns, soft-delete audit)
 * that only operators need.
 */
export const ownerFileOpenApiSchema = pageOpenApiSchema({
  type: "object",
  required: ["fileAssetId", "originalName", "visibility", "status", "createdAt"],
  properties: {
    fileAssetId: { type: "string", format: "uuid" },
    originalName: { type: "string" },
    contentType: { type: "string", nullable: true, description: "Server-verified MIME type" },
    size: { type: "integer", nullable: true },
    visibility: { type: "string", enum: ["public", "private"] },
    status: { type: "string", enum: ["pending", "ready", "failed"] },
    targetType: { type: "string", nullable: true },
    targetId: { type: "string", nullable: true },
    url: { type: "string", nullable: true, description: "Only present once ready" },
    downloadUrl: { type: "string", nullable: true },
    createdAt: { type: "string", format: "date-time" },
    completedAt: { type: "string", format: "date-time", nullable: true },
  },
});

/** Admin-facing file view — the full record incl. internal/audit fields. */
export const adminFileOpenApiSchema = pageOpenApiSchema({
  type: "object",
  required: ["fileAssetId", "originalName", "visibility", "status", "source", "createdAt"],
  properties: {
    fileAssetId: { type: "string", format: "uuid" },
    ownerUserId: { type: "string", nullable: true },
    source: { type: "string", enum: ["user", "admin", "system"] },
    originalName: { type: "string" },
    pathname: { type: "string" },
    url: { type: "string" },
    downloadUrl: { type: "string", nullable: true },
    contentType: { type: "string", nullable: true },
    size: { type: "integer", nullable: true },
    declaredContentType: { type: "string", nullable: true },
    declaredSize: { type: "integer", nullable: true },
    visibility: { type: "string", enum: ["public", "private"] },
    status: { type: "string", enum: ["pending", "ready", "failed", "deleted"] },
    scanStatus: { type: "string" },
    reviewStatus: { type: "string" },
    targetType: { type: "string", nullable: true },
    targetId: { type: "string", nullable: true },
    createdAt: { type: "string", format: "date-time" },
    completedAt: { type: "string", format: "date-time", nullable: true },
    deletedAt: { type: "string", format: "date-time", nullable: true },
    deletedBy: { type: "string", nullable: true },
  },
});
