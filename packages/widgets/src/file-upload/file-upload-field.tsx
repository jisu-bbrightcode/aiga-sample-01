/**
 * FileUploadField — app-ready file uploader widget (PB-FILE-UI-001 / BBR-554).
 *
 * Glue over `@repo/ui`'s transport-agnostic `FileUpload`: it builds the real
 * Vercel Blob transport and reads the shared auth state, so a domain form only
 * has to inject the target resource + allowed-file policy and a handler that
 * opens its own auth modal.
 *
 * The auth state comes from `@repo/core`'s `authenticatedAtom` (shared across
 * apps); when the visitor is signed out, `onRequireAuth` fires instead of the
 * upload starting — the app opens its auth modal rather than redirecting
 * (acceptance criterion §2).
 */

import { authenticatedAtom } from "@repo/core/auth";
import {
  type CompletedUpload,
  FileUpload,
  type UploadItem,
  type UploadPolicy,
  type UploadTargetRef,
} from "@repo/ui/components/file-upload";
import { useAtomValue } from "jotai";
import { createBlobUploadTransport } from "./create-blob-upload-transport";

export interface FileUploadFieldProps {
  /** API origin. "" in dev (Vite proxy) or the configured host in prod. */
  baseUrl?: string;
  /** Auth + tracing headers for the upload API calls. */
  getHeaders?: () => Record<string, string> | Promise<Record<string, string>>;
  /** Access policy for created assets. Defaults to private. */
  visibility?: "public" | "private";
  /** Resource the files attach to (forwarded to the API). */
  target?: UploadTargetRef;
  /** Allowed-file policy injected by the domain form. */
  policy?: UploadPolicy;
  /** Opens the app's auth modal when a signed-out visitor tries to upload. */
  onRequireAuth?: () => void;
  /** Start uploading as soon as a valid file is added. Default true. */
  autoStart?: boolean;
  onComplete?: (result: CompletedUpload, item: UploadItem) => void;
  onAllComplete?: (results: CompletedUpload[]) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}

export function FileUploadField({
  baseUrl,
  getHeaders,
  visibility,
  target,
  policy,
  onRequireAuth,
  autoStart,
  onComplete,
  onAllComplete,
  label,
  description,
  disabled,
  className,
}: FileUploadFieldProps) {
  const isAuthenticated = useAtomValue(authenticatedAtom) ?? false;
  const transport = createBlobUploadTransport({ baseUrl, getHeaders, visibility });

  return (
    <FileUpload
      transport={transport}
      policy={policy}
      target={target}
      isAuthenticated={isAuthenticated}
      onRequireAuth={onRequireAuth}
      autoStart={autoStart}
      onComplete={onComplete}
      onAllComplete={onAllComplete}
      label={label}
      description={description}
      disabled={disabled}
      className={className}
    />
  );
}
