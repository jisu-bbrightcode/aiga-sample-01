/**
 * Shared types for the reusable file-upload UI (PB-FILE-UI-001 / BBR-554).
 *
 * The component is transport-agnostic: it owns the per-file state machine,
 * client-side validation, preview and layout, but the actual bytes-on-the-wire
 * work is INJECTED as an {@link UploadTransport}. This keeps the UI pure and
 * unit-testable, and lets each app wire its own backend (Vercel Blob client
 * upload in production, a fake in tests) without changing the component.
 */

/** Lifecycle of a single file in the uploader. */
export type UploadStatus = "queued" | "uploading" | "success" | "error" | "canceled";

/** Allowed-policy knobs a domain form injects via props. */
export interface UploadPolicy {
  /**
   * Comma-separated accept list, same grammar as `<input accept>`:
   * MIME types (`image/png`), wildcards (`image/*`) or extensions (`.pdf`).
   * Drives both the native picker filter and client-side validation.
   */
  accept?: string;
  /** Max bytes per file. Defaults to 10MB to match the server policy. */
  maxSize?: number;
  /** Max number of files the uploader will hold at once. Defaults to 1. */
  maxFiles?: number;
}

/** The resource a file attaches to, forwarded to the transport. */
export interface UploadTargetRef {
  /** e.g. "profile", "hospital". */
  targetType?: string;
  /** Id of the attached resource. */
  targetId?: string;
}

/** Server-verified metadata returned once an upload is fully activated. */
export interface CompletedUpload {
  fileAssetId: string;
  url: string;
  contentType: string;
  size: number;
  visibility?: string;
  targetType?: string | null;
  targetId?: string | null;
}

/** Arguments handed to the injected transport for one file. */
export interface UploadTransportArgs {
  file: File;
  target: UploadTargetRef;
  /** Report 0–100 progress. May be called many times. */
  onProgress: (percent: number) => void;
  /** Aborted when the user cancels or the item is removed mid-flight. */
  signal: AbortSignal;
}

/**
 * Performs the real upload for a single file and resolves with the
 * server-verified asset. MUST reject with an `Error` whose `message` is already
 * user-safe (friendly, non-technical) — the UI renders it verbatim as the
 * server-validation error, so transports are responsible for mapping raw
 * server/network failures to stable, friendly copy (see the blob transport).
 */
export type UploadTransport = (args: UploadTransportArgs) => Promise<CompletedUpload>;

/** One row in the uploader. Treated as immutable — never mutated in place. */
export interface UploadItem {
  /** Stable local id (not the server's fileAssetId). */
  id: string;
  file: File;
  name: string;
  size: number;
  status: UploadStatus;
  /** 0–100. */
  progress: number;
  /** Pre-upload client validation error (e.g. too big / wrong type). */
  clientError?: string;
  /** Post-attempt server/transport error (already user-safe). */
  serverError?: string;
  /** Object URL for image previews; undefined for non-images. */
  previewUrl?: string;
  /** Server-verified asset, present once `status === "success"`. */
  result?: CompletedUpload;
}
