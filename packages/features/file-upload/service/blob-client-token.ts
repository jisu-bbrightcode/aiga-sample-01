import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import type { ClientTokenIssuer } from "./file-upload.service";

/**
 * Real {@link ClientTokenIssuer} backed by Vercel Blob. Isolated here so the
 * `@vercel/blob/client` dependency stays out of the service (keeping it
 * unit-testable) and the module simply wires this factory.
 *
 * Mirrors the official client-upload contract
 * (https://vercel.com/docs/vercel-blob/client-upload): the server generates a
 * client token bound to a specific pathname, with an allowed content-type list,
 * a size ceiling, an expiry, and a completion callback. The `BLOB_READ_WRITE_TOKEN`
 * is read by the SDK from the environment (or passed explicitly).
 */
export function createBlobClientTokenIssuer(readWriteToken?: string): ClientTokenIssuer {
  return async ({
    pathname,
    allowedContentTypes,
    maximumSizeInBytes,
    validUntil,
    callbackUrl,
    tokenPayload,
  }) =>
    generateClientTokenFromReadWriteToken({
      // `addRandomSuffix: false` keeps the upload pinned to our exact,
      // server-generated pathname (acceptance criteria §3).
      pathname,
      addRandomSuffix: false,
      allowedContentTypes,
      maximumSizeInBytes,
      validUntil,
      ...(callbackUrl ? { onUploadCompleted: { callbackUrl, tokenPayload } } : {}),
      ...(readWriteToken ? { token: readWriteToken } : {}),
    });
}
