/**
 * File-upload widget (PB-FILE-UI-001 / BBR-554).
 *
 * `FileUploadField` is the app-ready uploader (real Vercel Blob transport +
 * shared auth gating). `createBlobUploadTransport` is exposed for custom shells
 * that drive `@repo/ui`'s headless `useFileUpload` directly.
 */

export {
  type BlobUploadTransportConfig,
  createBlobUploadTransport,
} from "./create-blob-upload-transport";
export { FileUploadField, type FileUploadFieldProps } from "./file-upload-field";
