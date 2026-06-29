import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { $api, apiClient } from "@/lib/api";
import {
  type AdminBanUserBody,
  type AdminResolveReportBody,
  type AdminUnbanUserBody,
  COMMUNITY_ERROR_FALLBACK,
  communityQueryKeys,
  unwrapRestData,
} from "../api";

// ============================================================================
// Query Hooks
// ============================================================================

interface AdminCommunitiesInput {
  page: number;
  limit: number;
  search?: string;
  type?: "public" | "restricted" | "private";
}

/**
 * 커뮤니티 목록 (Admin)
 */
export function useAdminCommunities(input: AdminCommunitiesInput) {
  return $api.useQuery("get", "/api/admin/community", {
    params: { query: input },
  });
}

/**
 * 전체 통계 (Admin)
 */
export function useCommunityStats() {
  return $api.useQuery("get", "/api/admin/community/stats", {});
}

interface AdminReportsInput {
  page: number;
  limit: number;
  status?: "pending" | "reviewing" | "resolved" | "dismissed";
}

/**
 * 전체 신고 목록 (Admin)
 */
export function useAdminReports(input: AdminReportsInput) {
  return $api.useQuery("get", "/api/admin/community/reports", {
    params: { query: input },
  });
}

/**
 * 신고 통계 (Admin)
 */
export function useReportStats() {
  return $api.useQuery("get", "/api/admin/community/reports/stats", {});
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * 커뮤니티 삭제 (Admin)
 */
export function useDeleteCommunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["delete", "/api/admin/community/{id}"],
    mutationFn: async (input: { communityId: string }) => {
      return unwrapRestData(
        await apiClient.DELETE("/api/admin/community/{id}", {
          params: { path: { id: input.communityId } },
        }),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: communityQueryKeys.adminList() });
      queryClient.invalidateQueries({ queryKey: communityQueryKeys.adminStats() });
      toast.success("커뮤니티가 삭제되었습니다");
    },
    onError: () => {
      toast.error(COMMUNITY_ERROR_FALLBACK);
    },
  });
}

/**
 * 신고 처리 (Admin)
 */
export function useResolveReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["post", "/api/admin/community/reports/resolve"],
    mutationFn: async (input: AdminResolveReportBody) => {
      return unwrapRestData(
        await apiClient.POST("/api/admin/community/reports/resolve", {
          body: input,
        }),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: communityQueryKeys.adminReports() });
      queryClient.invalidateQueries({ queryKey: communityQueryKeys.adminReportStats() });
      toast.success("신고가 처리되었습니다");
    },
    onError: () => {
      toast.error(COMMUNITY_ERROR_FALLBACK);
    },
  });
}

/**
 * 사용자 밴 (Admin)
 */
export function useAdminBanUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["post", "/api/admin/community/ban"],
    mutationFn: async (input: AdminBanUserBody) => {
      return unwrapRestData(await apiClient.POST("/api/admin/community/ban", { body: input }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: communityQueryKeys.adminReports() });
      toast.success("사용자가 밴되었습니다");
    },
    onError: () => {
      toast.error(COMMUNITY_ERROR_FALLBACK);
    },
  });
}

/**
 * 밴 해제 (Admin)
 */
export function useAdminUnbanUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["post", "/api/admin/community/unban"],
    mutationFn: async (input: AdminUnbanUserBody) => {
      return unwrapRestData(await apiClient.POST("/api/admin/community/unban", { body: input }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: communityQueryKeys.adminReports() });
      toast.success("밴이 해제되었습니다");
    },
    onError: () => {
      toast.error(COMMUNITY_ERROR_FALLBACK);
    },
  });
}
