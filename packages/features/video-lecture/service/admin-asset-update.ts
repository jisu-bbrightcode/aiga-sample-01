export interface AdminAssetSnapshot {
  lessonId: string | null;
  requireSignedUrls: boolean;
}

export interface AdminAssetUpdateInput {
  lessonId?: string | null;
  title?: unknown;
  description?: unknown;
  freePreviewSeconds?: unknown;
  requireSignedUrls?: unknown;
}

export interface AdminAssetUpdateResolution {
  lessonId: string | null;
  requireSignedUrls: boolean;
  lessonMetadataLessonId: string | null;
  shouldUpdateProviderSignedUrls: boolean;
}

export function resolveAdminAssetUpdate(
  asset: AdminAssetSnapshot,
  input: AdminAssetUpdateInput,
): AdminAssetUpdateResolution {
  const hasLessonId = Object.hasOwn(input, "lessonId");
  const lessonId = hasLessonId ? (input.lessonId ?? null) : asset.lessonId;
  const requireSignedUrls =
    typeof input.requireSignedUrls === "boolean"
      ? input.requireSignedUrls
      : asset.requireSignedUrls;
  const hasLessonMetadata =
    typeof input.title === "string" ||
    typeof input.description === "string" ||
    typeof input.freePreviewSeconds === "number";

  return {
    lessonId,
    requireSignedUrls,
    lessonMetadataLessonId: hasLessonMetadata ? lessonId : null,
    shouldUpdateProviderSignedUrls:
      typeof input.requireSignedUrls === "boolean" &&
      input.requireSignedUrls !== asset.requireSignedUrls,
  };
}
