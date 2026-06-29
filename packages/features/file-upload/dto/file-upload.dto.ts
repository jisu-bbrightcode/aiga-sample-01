import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";

/**
 * Request body for `POST /files/uploads` (PB-FILE-API-CREATE-001 / BBR-548).
 *
 * Structural validation only — semantic policy (allowed MIME / extension / size
 * ceiling, §5.2 of PB-FILE-001) is enforced in the service via the upload-policy
 * module so it can reject with a stable 422 + machine code.
 *
 * `visibility` defaults to `private` (locked default, PB-FILE-001 §5.1). The
 * declared `contentType`/`size` are UNTRUSTED here; they only gate whether a
 * token is minted and become the token's content-type/size ceiling.
 */
export const createUploadInputSchema = z.object({
  /** Original filename incl. extension (display + extension policy check). */
  filename: z.string().min(1).max(255),
  /** Client-declared MIME type. */
  contentType: z.string().min(1).max(255),
  /** Client-declared byte size. */
  size: z.number().int().positive(),
  /** Access policy for the resulting asset. Defaults to private. */
  visibility: z.enum(["public", "private"]).default("private"),
  /** Resource kind the file attaches to, e.g. "profile", "hospital". */
  targetType: z.string().min(1).max(64).optional(),
  /** Id of the attached resource. */
  targetId: z.string().min(1).max(255).optional(),
});

export type CreateUploadInput = z.infer<typeof createUploadInputSchema>;

export class CreateUploadDto extends createZodDto(createUploadInputSchema) {}

/**
 * Response: the upload draft the client needs to perform a Vercel Blob client
 * upload (https://vercel.com/docs/vercel-blob/client-upload). The client calls
 * `put(pathname, file, { access: "public", token: clientToken, contentType })`
 * from `@vercel/blob/client`; Blob then calls our completion callback (BBR-549).
 */
export const uploadDraftOpenApiSchema = {
  type: "object",
  required: [
    "fileAssetId",
    "pathname",
    "clientToken",
    "contentType",
    "maximumSizeInBytes",
    "visibility",
    "expiresAt",
  ],
  properties: {
    fileAssetId: { type: "string", format: "uuid" },
    pathname: { type: "string", description: "Server-generated, collision-resistant Blob key" },
    clientToken: {
      type: "string",
      description: "Short-lived Vercel Blob client upload token bound to the pathname",
    },
    contentType: { type: "string" },
    maximumSizeInBytes: { type: "integer" },
    visibility: { type: "string", enum: ["public", "private"] },
    expiresAt: { type: "string", format: "date-time", description: "Pending row orphan TTL" },
  },
};

/**
 * Request body for `POST /files/uploads/complete` (PB-FILE-API-COMPLETE-001 /
 * BBR-549).
 *
 * The client sends ONLY the `fileAssetId` it received from `POST /files/uploads`.
 * It deliberately cannot send a Blob URL/pathname/size/content type: the server
 * looks up the pending row it created and re-derives the truth from the store
 * itself (acceptance criteria §1 — "임의 Blob URL을 주입할 수 없다", §4 — the
 * client's upload result is never trusted).
 */
export const completeUploadInputSchema = z.object({
  /** Id of the pending asset returned by `POST /files/uploads`. */
  fileAssetId: z.string().min(1).max(255),
});

export type CompleteUploadInput = z.infer<typeof completeUploadInputSchema>;

export class CompleteUploadDto extends createZodDto(completeUploadInputSchema) {}

/**
 * Response: the activated file asset after the server re-verified the uploaded
 * blob (Blob `head`) and flipped its status to `ready`. All fields are
 * server-verified — the client-declared values are never echoed back.
 */
export const completedUploadOpenApiSchema = {
  type: "object",
  required: [
    "fileAssetId",
    "status",
    "pathname",
    "url",
    "contentType",
    "size",
    "visibility",
    "completedAt",
  ],
  properties: {
    fileAssetId: { type: "string", format: "uuid" },
    status: { type: "string", enum: ["ready"] },
    pathname: { type: "string" },
    url: { type: "string", description: "Canonical, server-verified Blob URL" },
    downloadUrl: { type: "string", nullable: true },
    contentType: { type: "string", description: "Server-verified MIME type" },
    size: { type: "integer", description: "Server-verified byte size" },
    visibility: { type: "string", enum: ["public", "private"] },
    targetType: { type: "string", nullable: true },
    targetId: { type: "string", nullable: true },
    completedAt: { type: "string", format: "date-time" },
  },
};
