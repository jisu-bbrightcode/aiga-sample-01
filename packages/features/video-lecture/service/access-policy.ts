export type VideoLectureVisibility = "public" | "preview" | "protected" | "private";
export type VideoLectureEntitlementRequirement = "none" | "login" | "purchase" | "subscription";

export type VideoLectureAccessState =
  | "ready"
  | "not_logged_in"
  | "purchase_required"
  | "subscription_required"
  | "preview_only"
  | "archived_private";

export interface VideoLectureAccessSubject {
  visibility: string;
  entitlementRequirement: string;
  freePreviewSeconds: number;
}

export interface VideoLectureAccessContext {
  viewerId?: string;
  preview: boolean;
  entitlementGranted: boolean;
}

const paidAccessStates = {
  purchase: "purchase_required",
  subscription: "subscription_required",
} as const;

export function resolveVideoLectureAccess(
  subject: VideoLectureAccessSubject,
  context: VideoLectureAccessContext,
): VideoLectureAccessState {
  if (subject.visibility === "private") return "archived_private";
  if (context.preview && subject.freePreviewSeconds > 0) return "preview_only";
  if (subject.entitlementRequirement === "none") return "ready";
  if (subject.entitlementRequirement === "login")
    return context.viewerId ? "ready" : "not_logged_in";

  const paidState =
    paidAccessStates[subject.entitlementRequirement as keyof typeof paidAccessStates] ??
    "purchase_required";
  if (!context.viewerId) return "not_logged_in";
  return context.entitlementGranted ? "ready" : paidState;
}

export function isPublicLessonMetadataVisible(subject: { visibility: string }) {
  return subject.visibility !== "private";
}
