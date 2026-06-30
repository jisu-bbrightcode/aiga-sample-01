/**
 * ProfileImageUploadField (PB-FILE-UI-001 / BBR-554).
 *
 * Domain wrapper that reuses `@repo/widgets`'s `FileUploadField` for the most
 * common app case — a single public profile image — by injecting this app's API
 * origin + auth headers and a profile-scoped target/policy. Other domain forms
 * follow the same shape: pass a different `target` + `policy` (acceptance §4).
 */

import type { CompletedUpload } from "@repo/ui/components/file-upload";
import { FileUploadField } from "@repo/widgets/file-upload";
import { API_URL, getAuthHeaders } from "@/lib/auth-headers";

const PROFILE_IMAGE_POLICY = {
  accept: "image/png,image/jpeg,image/webp",
  maxSize: 5 * 1024 * 1024,
  maxFiles: 1,
} as const;

export interface ProfileImageUploadFieldProps {
  /** Profile id the image attaches to. */
  profileId: string;
  /** Called with the activated asset once the upload is verified. */
  onUploaded?: (result: CompletedUpload) => void;
  /** Opens the auth modal when a signed-out visitor tries to upload. */
  onRequireAuth?: () => void;
  className?: string;
}

export function ProfileImageUploadField({
  profileId,
  onUploaded,
  onRequireAuth,
  className,
}: ProfileImageUploadFieldProps) {
  return (
    <FileUploadField
      baseUrl={API_URL}
      getHeaders={getAuthHeaders}
      visibility="public"
      target={{ targetType: "profile", targetId: profileId }}
      policy={PROFILE_IMAGE_POLICY}
      onRequireAuth={onRequireAuth}
      onComplete={(result) => onUploaded?.(result)}
      label="프로필 이미지를 드래그하거나 클릭하여 업로드"
      description="PNG, JPG, WebP · 최대 5 MB"
      className={className}
    />
  );
}
