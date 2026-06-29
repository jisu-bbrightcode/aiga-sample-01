/**
 * Upload policy — pure validation + pathname generation for the client-upload
 * token flow (PB-FILE-API-CREATE-001 / BBR-548).
 *
 * Encodes the locked file-type / size / access policy from
 * doc/plans/PB-FILE-001-vercel-blob-file-upload-scope.md §5.2:
 *   - allowed MIME: image png/jpeg/webp/gif + application/pdf
 *   - blocked: executables/scripts and image/svg+xml (XSS risk)
 *   - max size: 10MB (matches the UI hook default)
 *
 * Trust boundary (acceptance criteria §2/§3): the server NEVER trusts the
 * client-declared content type for storage/exposure decisions; here we only
 * decide whether to *issue a token at all*. Final server-verified metadata is
 * confirmed by the completion API (BBR-549) on `onUploadCompleted`.
 *
 * This module is intentionally framework-free (no NestJS imports) so it can be
 * unit-tested directly and reused from any runtime.
 */

/** Default ceiling — 10MB, aligned with the reusable UI hook. */
export const DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Allowed content type → permitted file extensions, per the locked policy. */
export const ALLOWED_UPLOAD_TYPES: Readonly<Record<string, readonly string[]>> = {
  "image/png": ["png"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/webp": ["webp"],
  "image/gif": ["gif"],
  "application/pdf": ["pdf"],
};

export type UploadVisibility = "public" | "private";

/** Stable machine codes so callers (and clients) can branch without parsing copy. */
export type UploadPolicyCode =
  | "unsupported_content_type"
  | "extension_mismatch"
  | "invalid_filename"
  | "invalid_size"
  | "size_exceeded";

/**
 * A policy violation. Carries a stable `code` and a friendly, non-technical
 * Korean message. The service maps this to a 422 response; the message is safe
 * to surface to the user (no internal/technical detail).
 */
export class UploadPolicyError extends Error {
  readonly code: UploadPolicyCode;

  constructor(code: UploadPolicyCode, message: string) {
    super(message);
    this.name = "UploadPolicyError";
    this.code = code;
  }
}

export interface UploadPolicyInput {
  /** Original client filename (display + extension check). */
  filename: string;
  /** Client-declared MIME type (untrusted; used only to gate token issuance). */
  contentType: string;
  /** Client-declared byte size (untrusted; enforced as the token ceiling). */
  size: number;
}

export interface NormalizedUpload {
  contentType: string;
  extension: string;
  size: number;
  maxBytes: number;
}

/** Strip parameters and lowercase a MIME type, e.g. "Image/JPEG; x=1" -> "image/jpeg". */
function normalizeContentType(raw: string): string {
  return (raw.split(";")[0] ?? "").trim().toLowerCase();
}

/** Lowercase file extension without the dot, or "" when there is none. */
function extensionOf(filename: string): string {
  const base = filename.slice(filename.lastIndexOf("/") + 1);
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) return "";
  return base.slice(dot + 1).toLowerCase();
}

// Path separators + ASCII control chars (incl. NUL). Built from char codes to
// avoid an over-broad literal range that would also reject "." and spaces.
const UNSAFE_FILENAME_CHARS = /[/\\]/;
function hasControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) < 0x20) return true;
  }
  return false;
}

/** Reject path traversal, separators, control chars, and hidden/parent names. */
function isSafeFilename(filename: string): boolean {
  if (filename.length === 0 || filename.length > 255) return false;
  if (UNSAFE_FILENAME_CHARS.test(filename)) return false;
  if (hasControlChar(filename)) return false;
  if (filename.startsWith(".")) return false; // ".", "..", and dotfiles
  return true;
}

/**
 * Validate a client upload request against the locked policy.
 * Throws {@link UploadPolicyError} on any violation; returns the normalized,
 * server-trusted shape on success.
 */
export function validateUploadRequest(
  input: UploadPolicyInput,
  maxBytes: number = DEFAULT_MAX_UPLOAD_BYTES,
): NormalizedUpload {
  if (!isSafeFilename(input.filename)) {
    throw new UploadPolicyError(
      "invalid_filename",
      "파일 이름을 사용할 수 없습니다. 다른 이름으로 다시 시도해 주세요.",
    );
  }

  const contentType = normalizeContentType(input.contentType);
  const allowedExtensions = ALLOWED_UPLOAD_TYPES[contentType];
  if (!allowedExtensions) {
    throw new UploadPolicyError(
      "unsupported_content_type",
      "지원하지 않는 파일 형식입니다. 이미지(PNG, JPG, WebP, GIF) 또는 PDF만 업로드할 수 있습니다.",
    );
  }

  const extension = extensionOf(input.filename);
  if (!extension || !allowedExtensions.includes(extension)) {
    throw new UploadPolicyError(
      "extension_mismatch",
      "파일 형식과 확장자가 일치하지 않습니다. 파일을 확인한 뒤 다시 시도해 주세요.",
    );
  }

  if (!Number.isInteger(input.size) || input.size <= 0) {
    throw new UploadPolicyError(
      "invalid_size",
      "파일 크기를 확인할 수 없습니다. 다른 파일로 다시 시도해 주세요.",
    );
  }
  if (input.size > maxBytes) {
    const mb = Math.floor(maxBytes / (1024 * 1024));
    throw new UploadPolicyError(
      "size_exceeded",
      `파일이 너무 큽니다. ${mb}MB 이하의 파일만 업로드할 수 있습니다.`,
    );
  }

  return { contentType, extension, size: input.size, maxBytes };
}

export interface BuildPathnameInput {
  visibility: UploadVisibility;
  extension: string;
  /** Unguessable, collision-resistant id (ULID). Injected for determinism. */
  id: string;
  /** Clock for the date partition. Injected for determinism. */
  now: Date;
}

/**
 * Server-generated Blob pathname (acceptance criteria §3 — collision-resistant
 * and hard to guess). Shape: `uploads/{visibility}/{YYYY}/{MM}/{ulid}.{ext}`.
 *
 * The ULID provides the unguessable + collision-resistant entropy; the date
 * partition keeps the store browsable for ops/cleanup. The client is bound to
 * this exact pathname by the minted token, so it cannot pick its own location.
 */
export function buildBlobPathname(input: BuildPathnameInput): string {
  const year = input.now.getUTCFullYear().toString().padStart(4, "0");
  const month = (input.now.getUTCMonth() + 1).toString().padStart(2, "0");
  return `uploads/${input.visibility}/${year}/${month}/${input.id}.${input.extension}`;
}
