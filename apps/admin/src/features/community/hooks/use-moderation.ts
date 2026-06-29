/**
 * Community Moderation Hooks (커뮤니티 레벨)
 *
 * 특정 커뮤니티의 모더레이션 데이터 조회용 hooks
 * Admin 전체 조회는 use-admin-community.ts 참조
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { $api, apiClient } from "@/lib/api";
import {
  COMMUNITY_ERROR_FALLBACK,
  communityQueryKeys,
  type ResolveReportBody,
  unwrapRestData,
} from "../api";

/**
 * 모더레이션 큐 조회 (커뮤니티 레벨)
 */
export function useModerationQueue(communityId: string, enabled = true) {
  return $api.useQuery(
    "get",
    "/api/community/moderation/{communityId}/queue",
    {
      params: { path: { communityId } },
    },
    {
      enabled: !!communityId && enabled,
    },
  );
}

/**
 * 신고 목록 조회 (커뮤니티 레벨)
 */
export function useModerationReports(
  communityId: string,
  status?: "pending" | "reviewing" | "resolved" | "dismissed",
  enabled = true,
) {
  return $api.useQuery(
    "get",
    "/api/community/moderation/{communityId}/reports",
    {
      params: {
        path: { communityId },
        query: { status },
      },
    },
    {
      enabled: !!communityId && enabled,
    },
  );
}

/**
 * 모더레이션 로그 조회 (커뮤니티 레벨)
 */
export function useModerationLogs(
  input: { communityId: string; page?: number; limit?: number },
  enabled = true,
) {
  return $api.useQuery(
    "get",
    "/api/community/moderation/{communityId}/logs",
    {
      params: {
        path: { communityId: input.communityId },
        query: { page: input.page, limit: input.limit },
      },
    },
    {
      enabled: !!input.communityId && enabled,
    },
  );
}

/**
 * 신고 처리 (커뮤니티 모더레이터)
 */
export function useResolveReportMod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["post", "/api/community/moderation/reports/resolve"],
    mutationFn: async (input: ResolveReportBody) => {
      return unwrapRestData(
        await apiClient.POST("/api/community/moderation/reports/resolve", {
          body: input,
        }),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: communityQueryKeys.moderationReports() });
      queryClient.invalidateQueries({ queryKey: communityQueryKeys.moderationQueue() });
      toast.success("신고가 처리되었습니다");
    },
    onError: () => {
      toast.error(COMMUNITY_ERROR_FALLBACK);
    },
  });
}
