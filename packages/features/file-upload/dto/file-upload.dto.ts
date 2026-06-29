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
