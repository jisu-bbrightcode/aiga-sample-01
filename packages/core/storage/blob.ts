/**
 * Vercel Blob upload helpers — repo-wide. Use from any server feature
 * (NestJS service, Next/Vite API route, scripts) when you need to push
 * a binary asset to Blob and persist only its public URL on the row.
 *
 *   import { uploadDataUrlToBlob } from "@repo/core/storage/blob";
 *   const { url } = await uploadDataUrlToBlob(dataUrl, `project-covers/${id}`);
 *   await db.update(...).set({ coverImage: url });
 *
 * Requires `BLOB_READ_WRITE_TOKEN` in the environment. The `@vercel/blob`
 * SDK reads it directly via `process.env`.
 */

import { del, put } from "@vercel/blob";

export interface BlobUploadResult {
  /** Public CDN URL — store this on the DB row. */
  url: string;
  /** Path inside the Blob store (without the host). */
  pathname: string;
  /** Resolved content-type (e.g. `image/png`). */
  contentType: string;
  /** Bytes uploaded. */
  size: number;
}

export interface UploadDataUrlOptions {
  /** When true (default), Vercel adds a random suffix to avoid collisions. */
  addRandomSuffix?: boolean;
  /** Override the auto-derived file extension. Without leading dot. */
  ext?: string;
}

const DATA_URL_RE = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,(.+)$/i;

/**
 * Upload a `data:<mime>;base64,...` URL (typical FileReader output) to
 * Vercel Blob. Returns the public URL — caller stores it on the row.
 *
 * @param dataUrl  base64 data URL from the client
 * @param prefix   logical key prefix (e.g. `project-covers/{id}`)
 */
export async function uploadDataUrlToBlob(
  dataUrl: string,
  prefix: string,
  options: UploadDataUrlOptions = {},
): Promise<BlobUploadResult> {
  const match = dataUrl.match(DATA_URL_RE);
  if (!match) {
    throw new Error("uploadDataUrlToBlob: input must be a base64 data: URL");
  }
  const contentType = match[1] ?? "application/octet-stream";
  const base64 = match[2] ?? "";
  const buffer = Buffer.from(base64, "base64");

  const ext = options.ext ?? extensionFromContentType(contentType) ?? "bin";
  const key = `${trimSlashes(prefix)}/${Date.now()}.${ext}`;

  return await uploadBufferToBlob(buffer, key, contentType, {
    addRandomSuffix: options.addRandomSuffix ?? true,
  });
}

export interface UploadBufferOptions {
  addRandomSuffix?: boolean;
}

/**
 * Upload a raw buffer to Vercel Blob at the given key. Use this when
 * you already have bytes (multipart upload, server-side fetched asset).
 */
export async function uploadBufferToBlob(
  buffer: Buffer | Uint8Array,
  key: string,
  contentType: string,
  options: UploadBufferOptions = {},
): Promise<BlobUploadResult> {
  const body = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const blob = await put(key, body, {
    access: "public",
    contentType,
    addRandomSuffix: options.addRandomSuffix ?? true,
  });

  return {
    url: blob.url,
    pathname: blob.pathname,
    contentType,
    size: body.byteLength,
  };
}

/**
 * Delete a blob by its public URL. Safe to call on a stale URL — Vercel
 * returns 404 quietly. Use after replacing or removing a cover so old
 * uploads don't accumulate forever.
 */
export async function deleteBlob(url: string): Promise<void> {
  try {
    await del(url);
  } catch (err) {
    // Idempotent — surface the error but don't crash the caller.
    if (err instanceof Error && /not.?found/i.test(err.message)) return;
    throw err;
  }
}

function extensionFromContentType(contentType: string): string | null {
  // Strip any params (e.g. "image/jpeg; charset=utf-8") and take the
  // sub-type ("jpeg"). Drop "+xml" / "+json" facets.
  const main = contentType.split(";")[0]?.trim() ?? "";
  const sub = main.split("/")[1]?.split("+")[0];
  if (!sub) return null;
  // Common normalizations.
  if (sub === "jpeg") return "jpg";
  if (sub === "svg") return "svg";
  return sub;
}

function trimSlashes(s: string): string {
  return s.replace(/^\/+/, "").replace(/\/+$/, "");
}
