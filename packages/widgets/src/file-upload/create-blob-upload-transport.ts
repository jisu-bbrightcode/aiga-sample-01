/**
 * Vercel Blob client-upload transport (PB-FILE-UI-001 / BBR-554).
 *
 * Concrete {@link UploadTransport} that drives the server-authoritative flow
 * shipped by PB-FILE-API-CREATE-001 (BBR-548) + PB-FILE-API-COMPLETE-001
 * (BBR-549):
 *
 *   1. `POST /api/files/uploads` → server mints a pathname + short-lived client
 *      token (rejects disallowed type/size with 422 before any byte moves).
 *   2. `put(pathname, file, { token })` → bytes go browser → Blob directly, with
 *      progress + cancellation.
 *   3. `POST /api/files/uploads/complete` → server re-verifies the stored blob
 *      and activates the asset; the client never sends a Blob URL/size.
 *
 * All failures are mapped to user-safe copy (see {@link toUploadError}) so the
 * UI can render the rejection message directly.
 */

import type { CompletedUpload, UploadTransport } from "@repo/ui/components/file-upload";
import { put } from "@vercel/blob/client";
import { genericUploadError, toUploadError } from "./server-error";

export interface BlobUploadTransportConfig {
  /** API origin. "" in dev (Vite proxy) or the configured host in prod. */
  baseUrl?: string;
  /** Auth + tracing headers for the two API calls (e.g. Bearer token). */
  getHeaders?: () => Record<string, string> | Promise<Record<string, string>>;
  /** Access policy for created assets. Defaults to private. */
  visibility?: "public" | "private";
}

interface UploadDraft {
  fileAssetId: string;
  pathname: string;
  clientToken: string;
  contentType: string;
  maximumSizeInBytes: number;
  visibility: string;
}

/** Read `{ code }` out of an error body without throwing on non-JSON. */
async function readErrorCode(res: Response): Promise<string | null> {
  try {
    const body = (await res.json()) as { code?: string; error?: { code?: string } };
    return body.code ?? body.error?.code ?? null;
  } catch {
    return null;
  }
}

export function createBlobUploadTransport(config: BlobUploadTransportConfig = {}): UploadTransport {
  const baseUrl = config.baseUrl ?? "";
  const visibility = config.visibility ?? "private";
  const headersFn = config.getHeaders ?? (() => ({}));

  async function jsonHeaders(): Promise<Record<string, string>> {
    const extra = await headersFn();
    return { "content-type": "application/json", ...extra };
  }

  return async ({ file, target, onProgress, signal }) => {
    // 1) Create — gets the server-bound pathname + client token.
    const createRes = await fetch(`${baseUrl}/api/files/uploads`, {
      method: "POST",
      headers: await jsonHeaders(),
      signal,
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type,
        size: file.size,
        visibility,
        ...(target.targetType ? { targetType: target.targetType } : {}),
        ...(target.targetId ? { targetId: target.targetId } : {}),
      }),
    });
    if (!createRes.ok) {
      throw toUploadError(createRes.status, await readErrorCode(createRes));
    }
    const draft = (await createRes.json()) as UploadDraft;

    // 2) Upload bytes directly to Blob with progress + cancellation.
    await put(draft.pathname, file, {
      access: "public",
      token: draft.clientToken,
      contentType: draft.contentType,
      abortSignal: signal,
      onUploadProgress: ({ percentage }: { loaded: number; total: number; percentage: number }) =>
        onProgress(percentage),
    }).catch((error: unknown) => {
      // Abort surfaces here too; the UI distinguishes it via the AbortSignal.
      if (signal.aborted) throw error;
      throw genericUploadError();
    });

    // 3) Complete — server re-verifies the blob and activates the asset.
    const completeRes = await fetch(`${baseUrl}/api/files/uploads/complete`, {
      method: "POST",
      headers: await jsonHeaders(),
      signal,
      body: JSON.stringify({ fileAssetId: draft.fileAssetId }),
    });
    if (!completeRes.ok) {
      throw toUploadError(completeRes.status, await readErrorCode(completeRes));
    }

    const completed = (await completeRes.json()) as {
      fileAssetId: string;
      url: string;
      contentType: string;
      size: number;
      visibility?: string;
      targetType?: string | null;
      targetId?: string | null;
    };
    return {
      fileAssetId: completed.fileAssetId,
      url: completed.url,
      contentType: completed.contentType,
      size: completed.size,
      visibility: completed.visibility,
      targetType: completed.targetType,
      targetId: completed.targetId,
    } satisfies CompletedUpload;
  };
}
