/**
 * Reusable file-upload UI (PB-FILE-UI-001 / BBR-554).
 *
 * `FileUpload` is the drop-in component; `useFileUpload` is the headless state
 * machine for custom shells. Both are transport-agnostic — wire a real
 * {@link UploadTransport} (e.g. `@repo/widgets/file-upload`'s Vercel Blob
 * transport) at the app boundary.
 */

export { FileUpload, type FileUploadProps } from "./file-upload";
export type {
  CompletedUpload,
  UploadItem,
  UploadPolicy,
  UploadStatus,
  UploadTargetRef,
  UploadTransport,
  UploadTransportArgs,
} from "./types";
export {
  type UseFileUploadOptions,
  type UseFileUploadResult,
  useFileUpload,
} from "./use-file-upload";
export {
  DEFAULT_MAX_FILES,
  DEFAULT_MAX_UPLOAD_BYTES,
  formatBytes,
  validateFileAgainstPolicy,
} from "./validation";
