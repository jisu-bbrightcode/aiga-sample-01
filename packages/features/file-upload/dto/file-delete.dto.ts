import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";

/**
 * Contracts for the file delete + cleanup endpoints
 * (PB-FILE-API-DELETE-001 / BBR-553).
 *
 * - `DELETE /files/:id` — the owner soft-deletes their own file.
 * - `DELETE /admin/files/:id` — an operator force-deletes any file.
 * - `POST /admin/files/cleanup` — runs the orphan/blob cleanup sweep.
 *
 * Deletion is a soft delete (`status="deleted"` + audit columns); the read
 * paths (list/detail/domain references) already exclude deleted rows, so a
 * deletion never breaks an existing reference (acceptance criteria §4).
 */

/** `POST /admin/files/cleanup` body — bounds one sweep pass. */
export const cleanupFilesBodySchema = z.object({
  /** Max rows to process per pass (per cleanup phase). */
  limit: z.coerce.number().int().min(1).max(1000).optional().default(100),
});
export type CleanupFilesBody = z.infer<typeof cleanupFilesBodySchema>;
export class CleanupFilesBodyDto extends createZodDto(cleanupFilesBodySchema) {}

/** Response of a (soft) delete. */
export const deletedFileOpenApiSchema = {
  type: "object",
  required: ["fileAssetId", "status", "deletedAt"],
  properties: {
    fileAssetId: { type: "string", format: "uuid" },
    status: { type: "string", enum: ["deleted"] },
    deletedAt: { type: "string", format: "date-time" },
  },
};

/** Response of one cleanup sweep. */
export const cleanupResultOpenApiSchema = {
  type: "object",
  required: ["orphanPendingReaped", "deletedBlobsPurged", "blobDeleteFailures"],
  properties: {
    orphanPendingReaped: {
      type: "integer",
      description: "Expired pending uploads reaped (token issued, never completed)",
    },
    deletedBlobsPurged: {
      type: "integer",
      description: "Soft-deleted rows whose blob bytes were reclaimed this pass",
    },
    blobDeleteFailures: {
      type: "integer",
      description: "Blob purges that failed again and remain queued for the next pass",
    },
  },
};
