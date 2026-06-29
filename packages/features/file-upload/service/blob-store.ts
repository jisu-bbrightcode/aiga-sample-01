import { BlobNotFoundError, del, head } from "@vercel/blob";
import type { BlobDeleter, BlobHeadReader } from "./file-upload.service";

/**
 * Real {@link BlobHeadReader}/{@link BlobDeleter} backed by Vercel Blob, used by
 * the completion API (PB-FILE-API-COMPLETE-001 / BBR-549).
 *
 * Isolated here so the `@vercel/blob` dependency (and its error classes) stays
 * out of the service — keeping the service unit-testable without a live store.
 *
 * The reader maps a missing blob to `null` (an *orphan* — token issued but the
 * client never finished uploading) and lets transient errors propagate so the
 * service can tell "definitely not uploaded" apart from "try again later".
 */
export function createBlobHeadReader(readWriteToken?: string): BlobHeadReader {
  return async (pathname: string) => {
    try {
      const info = await head(pathname, readWriteToken ? { token: readWriteToken } : undefined);
      return {
        url: info.url,
        downloadUrl: info.downloadUrl,
        pathname: info.pathname,
        contentType: info.contentType,
        size: info.size,
      };
    } catch (error) {
      // Not found = the upload never landed (orphan). Anything else is transient.
      if (error instanceof BlobNotFoundError) return null;
      throw error;
    }
  };
}

/**
 * Real {@link BlobDeleter} backed by Vercel Blob — used to roll back orphaned or
 * policy-violating uploads so no stray bytes are left in the store.
 */
export function createBlobDeleter(readWriteToken?: string): BlobDeleter {
  return async (pathname: string) => {
    await del(pathname, readWriteToken ? { token: readWriteToken } : undefined);
  };
}
