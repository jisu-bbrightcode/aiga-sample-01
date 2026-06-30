import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";

/**
 * Request contracts for the file metadata update endpoints
 * (PB-FILE-API-UPDATE-001 / BBR-552).
 *
 * - `PATCH /files/:id` — the owner edits their own file's metadata.
 * - `PATCH /admin/files/:id` — an operator edits any file, and may additionally
 *   set the moderation `reviewStatus`.
 *
 * These contracts cover METADATA only (acceptance criteria §1): there is no
 * field to swap the binary (blob URL / pathname / content type / size). The
 * permission + visibility policy (§2) is enforced in the service/policy layer,
 * not here. `null` clears a nullable field; an omitted key is left unchanged.
 */

const visibilityEnum = z.enum(["public", "private"]);
const reviewStatusEnum = z.enum(["not_required", "pending", "approved", "rejected"]);

/** Editable fields shared by owner + admin. */
const baseMetadataShape = {
  /** Display name (stored as `original_name`). */
  displayName: z.string().trim().min(1).max(255).optional(),
  /** Accessibility alt text; `null` clears it. */
  altText: z.string().trim().max(1000).nullable().optional(),
  /** Target resource kind the file is attached to; `null` detaches. */
  targetType: z.string().trim().min(1).max(64).nullable().optional(),
  /** Target resource id; `null` detaches. Must be paired with `targetType`. */
  targetId: z.string().trim().min(1).max(255).nullable().optional(),
  /** Access policy. Public requires passing the visibility policy. */
  visibility: visibilityEnum.optional(),
  /** Display order within a target's collection (>= 0). */
  sortOrder: z.coerce.number().int().min(0).max(1_000_000).optional(),
  /** Optional human reason recorded in the audit trail. */
  reason: z.string().trim().max(500).optional(),
} as const;

/** The metadata keys (excludes `reason`) used to require a non-empty patch. */
const OWNER_METADATA_KEYS = [
  "displayName",
  "altText",
  "targetType",
  "targetId",
  "visibility",
  "sortOrder",
] as const;

function hasAtLeastOne(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return keys.some((k) => value[k] !== undefined);
}

/** `PATCH /files/:id` — owner cannot touch moderation `reviewStatus`. */
export const updateOwnFileMetadataSchema = z
  .object(baseMetadataShape)
  .strict()
  .refine((v) => hasAtLeastOne(v, OWNER_METADATA_KEYS), {
    message: "수정할 metadata 필드를 하나 이상 포함해야 합니다.",
  });
export type UpdateOwnFileMetadata = z.infer<typeof updateOwnFileMetadataSchema>;
export class UpdateOwnFileMetadataDto extends createZodDto(updateOwnFileMetadataSchema) {}

/** `PATCH /admin/files/:id` — owner fields plus moderation `reviewStatus`. */
export const updateAdminFileMetadataSchema = z
  .object({ ...baseMetadataShape, reviewStatus: reviewStatusEnum.optional() })
  .strict()
  .refine((v) => hasAtLeastOne(v, [...OWNER_METADATA_KEYS, "reviewStatus"]), {
    message: "수정할 metadata 필드를 하나 이상 포함해야 합니다.",
  });
export type UpdateAdminFileMetadata = z.infer<typeof updateAdminFileMetadataSchema>;
export class UpdateAdminFileMetadataDto extends createZodDto(updateAdminFileMetadataSchema) {}

/** Response: the file's metadata after the update (binary fields unchanged). */
export const fileMetadataOpenApiSchema = {
  type: "object",
  required: [
    "fileAssetId",
    "displayName",
    "visibility",
    "status",
    "reviewStatus",
    "sortOrder",
    "updatedAt",
  ],
  properties: {
    fileAssetId: { type: "string", format: "uuid" },
    displayName: { type: "string", description: "stored as original_name" },
    altText: { type: "string", nullable: true },
    targetType: { type: "string", nullable: true },
    targetId: { type: "string", nullable: true },
    visibility: { type: "string", enum: ["public", "private"] },
    status: {
      type: "string",
      enum: ["pending", "ready", "failed", "deleted"],
      description: "Binary lifecycle — never changed by this endpoint (AC §1)",
    },
    reviewStatus: {
      type: "string",
      enum: ["not_required", "pending", "approved", "rejected"],
    },
    sortOrder: { type: "integer" },
    updatedAt: { type: "string", format: "date-time" },
  },
};
