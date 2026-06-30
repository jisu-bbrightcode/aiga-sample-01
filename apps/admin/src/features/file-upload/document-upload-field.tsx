/**
 * DocumentUploadField (PB-FILE-UI-001 / BBR-554).
 *
 * Admin-side reuse of `@repo/widgets`'s `FileUploadField` — same component as
 * the user app, wired with the admin API origin + auth headers and a different
 * target/policy (private attachments, images or PDF, several files). Proves the
 * uploader is reused across apps by injecting props, not by forking UI
 * (acceptance §4).
 */

import type { CompletedUpload } from "@repo/ui/components/file-upload";
import { FileUploadField } from "@repo/widgets/file-upload";
import { API_URL, getAuthHeaders } from "@/lib/api";

const DOCUMENT_POLICY = {
  accept: "image/png,image/jpeg,image/webp,application/pdf,.pdf",
  maxSize: 10 * 1024 * 1024,
  maxFiles: 5,
} as const;

export interface DocumentUploadFieldProps {
  /** Resource kind the documents attach to, e.g. "hospital" or "doctor". */
  targetType: string;
  /** Id of the attached resource. */
  targetId: string;
  /** Called for each verified upload. */
  onUploaded?: (result: CompletedUpload) => void;
  className?: string;
}

export function DocumentUploadField({
  targetType,
  targetId,
  onUploaded,
  className,
}: DocumentUploadFieldProps) {
  return (
    <FileUploadField
      baseUrl={API_URL}
      getHeaders={getAuthHeaders}
      visibility="private"
      target={{ targetType, targetId }}
      policy={DOCUMENT_POLICY}
      onComplete={(result) => onUploaded?.(result)}
      label="문서를 드래그하거나 클릭하여 업로드"
      description="이미지 또는 PDF · 최대 10 MB · 5개까지"
      className={className}
    />
  );
}
