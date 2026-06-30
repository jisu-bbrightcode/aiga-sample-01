/**
 * Map upload API failures to stable, user-safe Korean copy (PB-FILE-UI-001).
 *
 * The reusable UI renders a transport's rejection `message` verbatim, so the
 * transport must never leak a raw server/network string (CLAUDE.md §5 — no
 * `error.message`/status/`reason` in user-facing surfaces). We branch on the
 * server's stable machine `code` first (the file-upload service returns
 * `{ code, message }` on 422), then on HTTP status, with a friendly fallback.
 */

/** Machine codes emitted by the file-upload service's 422 responses. */
const UPLOAD_CODE_COPY: Readonly<Record<string, string>> = {
  unsupported_content_type:
    "지원하지 않는 파일 형식입니다. 이미지(PNG, JPG, WebP, GIF) 또는 PDF만 업로드할 수 있습니다.",
  extension_mismatch:
    "파일 형식과 확장자가 일치하지 않습니다. 파일을 확인한 뒤 다시 시도해 주세요.",
  invalid_filename: "파일 이름을 사용할 수 없습니다. 다른 이름으로 다시 시도해 주세요.",
  invalid_size: "파일 크기를 확인할 수 없습니다. 다른 파일로 다시 시도해 주세요.",
  size_exceeded: "파일이 너무 큽니다. 허용된 크기 이하의 파일만 업로드할 수 있습니다.",
  upload_not_found: "업로드가 완료되지 않았습니다. 파일을 다시 업로드해 주세요.",
};

const STATUS_COPY: Readonly<Record<number, string>> = {
  401: "로그인이 필요합니다. 다시 로그인한 뒤 시도해 주세요.",
  403: "이 파일을 업로드할 권한이 없습니다.",
  404: "업로드 정보를 찾을 수 없습니다. 처음부터 다시 시도해 주세요.",
  413: "파일이 너무 큽니다. 허용된 크기 이하의 파일만 업로드할 수 있습니다.",
  429: "요청이 많아 잠시 후 다시 시도해 주세요.",
};

const GENERIC = "파일 업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.";

/** Build a user-safe Error from an HTTP status + optional machine code. */
export function toUploadError(status: number, code?: string | null): Error {
  if (code && UPLOAD_CODE_COPY[code]) return new Error(UPLOAD_CODE_COPY[code]);
  if (STATUS_COPY[status]) return new Error(STATUS_COPY[status]);
  return new Error(GENERIC);
}

/** Error used when the upload step itself (network/store) fails, not our API. */
export function genericUploadError(): Error {
  return new Error(GENERIC);
}
