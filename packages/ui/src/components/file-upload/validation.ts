/**
 * Client-side upload validation (PB-FILE-UI-001 / BBR-554).
 *
 * Pure helpers, no React. The server re-validates everything authoritatively
 * (PB-FILE-001 §5.2); this is the FIRST of the two error surfaces acceptance
 * criterion §1 requires — fast, friendly feedback before a byte leaves the
 * browser. Messages are user-safe Korean copy.
 */

import type { UploadPolicy } from "./types";

/** Default ceiling — 10MB, aligned with the server's DEFAULT_MAX_UPLOAD_BYTES. */
export const DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Default to a single file unless a domain form opts into more. */
export const DEFAULT_MAX_FILES = 1;

/** Human-friendly size, e.g. 1536 -> "1.5 KB", 10485760 -> "10 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
}

/** Whether a file matches a single `accept` token (MIME, wildcard, or `.ext`). */
function matchesAcceptToken(file: File, token: string): boolean {
  const t = token.trim().toLowerCase();
  if (!t) return false;
  if (t.startsWith(".")) return file.name.toLowerCase().endsWith(t);
  if (t.endsWith("/*")) return file.type.toLowerCase().startsWith(t.slice(0, -1));
  return file.type.toLowerCase() === t;
}

/**
 * Validate one file against the injected policy. Returns a friendly Korean
 * error string, or `null` when the file passes.
 */
export function validateFileAgainstPolicy(file: File, policy: UploadPolicy = {}): string | null {
  const maxSize = policy.maxSize ?? DEFAULT_MAX_UPLOAD_BYTES;

  if (file.size === 0) {
    return "빈 파일은 업로드할 수 없습니다. 다른 파일을 선택해 주세요.";
  }
  if (file.size > maxSize) {
    return `파일이 너무 큽니다. ${formatBytes(maxSize)} 이하의 파일만 업로드할 수 있습니다.`;
  }

  if (policy.accept) {
    const tokens = policy.accept.split(",");
    const ok = tokens.some((token) => matchesAcceptToken(file, token));
    if (!ok) {
      return "지원하지 않는 파일 형식입니다. 허용된 형식의 파일을 선택해 주세요.";
    }
  }

  return null;
}
