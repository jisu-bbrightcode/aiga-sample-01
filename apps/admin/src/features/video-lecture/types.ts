export interface VideoLectureAsset {
  id: string;
  lessonId: string | null;
  provider: "cloudflare_stream";
  providerAssetId: string;
  playbackUid: string | null;
  uploadMethod: string;
  uploadUrl: string | null;
  status: "pending" | "uploading" | "processing" | "ready" | "failed" | "archived" | "deleted";
  readyToStream: boolean;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  visibility: "public" | "preview" | "protected" | "private";
  entitlementRequirement: "none" | "login" | "purchase" | "subscription";
  requireSignedUrls: boolean;
  processingErrorCode: string | null;
  processingErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UploadSessionResult {
  asset: VideoLectureAsset;
  method: "direct" | "tus";
  uploadUrl: string;
  providerAssetId: string;
  uploadHeaders?: Record<string, string>;
}
