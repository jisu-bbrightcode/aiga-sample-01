import type { operations } from "@repo/api-client";
import { apiClient } from "@/lib/api";

export const COMMUNITY_ERROR_FALLBACK = "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";

export const communityQueryKeys = {
  all: ["community"] as const,
  list: () => ["get", "/api/community"] as const,
  bySlug: (slug: string) =>
    ["get", "/api/community/{slug}", { params: { path: { slug } } }] as const,
  popular: () => ["get", "/api/community/popular"] as const,
  mySubscriptions: () => ["get", "/api/community/me/subscriptions"] as const,
  myMembership: (slug: string) =>
    ["get", "/api/community/me/membership/{slug}", { params: { path: { slug } } }] as const,
  posts: () => ["get", "/api/community/posts"] as const,
  postByIdBase: () => ["get", "/api/community/posts/{id}"] as const,
  postById: (id: string) =>
    ["get", "/api/community/posts/{id}", { params: { path: { id } } }] as const,
  postCommentsBase: () => ["get", "/api/community/posts/{id}/comments"] as const,
  postComments: (id: string) =>
    ["get", "/api/community/posts/{id}/comments", { params: { path: { id } } }] as const,
  moderationQueue: () => ["get", "/api/community/moderation/{communityId}/queue"] as const,
  moderationReports: () => ["get", "/api/community/moderation/{communityId}/reports"] as const,
  moderationLogs: () => ["get", "/api/community/moderation/{communityId}/logs"] as const,
  adminList: () => ["get", "/api/admin/community"] as const,
  adminStats: () => ["get", "/api/admin/community/stats"] as const,
  adminReports: () => ["get", "/api/admin/community/reports"] as const,
  adminReportStats: () => ["get", "/api/admin/community/reports/stats"] as const,
};

export type CreateCommunityBody =
  operations["CommunityController_create"]["requestBody"]["content"]["application/json"];
export type CreatePostBody =
  operations["CommunityController_createPost"]["requestBody"]["content"]["application/json"];
export type CreatePostInput = Omit<CreatePostBody, "communityId"> & {
  communityId?: string;
  communitySlug?: string;
};
export type UpdatePostBody =
  operations["CommunityController_updatePost"]["requestBody"]["content"]["application/json"];
export type CreateCommentBody =
  operations["CommunityController_createComment"]["requestBody"]["content"]["application/json"];
export type UpdateCommentBody =
  operations["CommunityController_updateComment"]["requestBody"]["content"]["application/json"];
export type CastVoteBody =
  operations["CommunityController_castVote"]["requestBody"]["content"]["application/json"];
export type ResolveReportBody =
  operations["CommunityController_resolveReport"]["requestBody"]["content"]["application/json"];
export type AdminResolveReportBody =
  operations["CommunityAdminController_resolveReport"]["requestBody"]["content"]["application/json"];
export type AdminBanUserBody =
  operations["CommunityAdminController_banUser"]["requestBody"]["content"]["application/json"];
export type AdminUnbanUserBody =
  operations["CommunityAdminController_unbanUser"]["requestBody"]["content"]["application/json"];
export type PostResponse =
  operations["CommunityController_postById"]["responses"][200]["content"]["application/json"];
export type PostListResponse =
  operations["CommunityController_postList"]["responses"][200]["content"]["application/json"];
export type CommentListResponse =
  operations["CommunityController_postComments"]["responses"][200]["content"]["application/json"];

export function unwrapRestData<T>(result: { data?: T; error?: unknown }): T {
  if (result.error) throw result.error;
  if (result.data === undefined) throw new Error("rest_empty_response");
  return result.data;
}

export async function resolveCommunityId(input: CreatePostInput): Promise<string> {
  if (input.communityId) return input.communityId;
  if (!input.communitySlug) throw new Error("community_id_required");

  const data = unwrapRestData(
    await apiClient.GET("/api/community/{slug}", {
      params: { path: { slug: input.communitySlug } },
    }),
  );
  return data.id;
}
