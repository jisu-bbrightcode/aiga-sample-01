/**
 * Community Hooks
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { $api, apiClient } from "@/lib/api";
import { type CreateCommunityBody, communityQueryKeys, unwrapRestData } from "../api";

export function useCommunities(options?: {
  search?: string;
  type?: "public" | "restricted" | "private";
  sort?: "newest" | "popular" | "name";
  limit?: number;
}) {
  return $api.useInfiniteQuery(
    "get",
    "/api/community",
    {
      params: {
        query: {
          search: options?.search,
          type: options?.type,
          sort: options?.sort,
          limit: options?.limit,
        },
      },
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      initialPageParam: undefined as string | undefined,
    },
  );
}

export function useCommunity(slug: string) {
  return $api.useQuery("get", "/api/community/{slug}", {
    params: { path: { slug } },
  });
}

export function usePopularCommunities(limit?: number) {
  return $api.useQuery("get", "/api/community/popular", {
    params: { query: { limit: limit ?? 10 } },
  });
}

export function useMySubscriptions() {
  return $api.useQuery("get", "/api/community/me/subscriptions", {});
}

export function useMyMembership(slug: string) {
  return $api.useQuery("get", "/api/community/me/membership/{slug}", {
    params: { path: { slug } },
  });
}

export function useCreateCommunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["post", "/api/community"],
    mutationFn: async (input: CreateCommunityBody) => {
      return unwrapRestData(await apiClient.POST("/api/community", { body: input }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: communityQueryKeys.list() });
    },
  });
}

export function useJoinCommunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["post", "/api/community/{slug}/join"],
    mutationFn: async (slug: string) => {
      return unwrapRestData(
        await apiClient.POST("/api/community/{slug}/join", {
          params: { path: { slug } },
        }),
      );
    },
    onSuccess: (_data, slug) => {
      queryClient.invalidateQueries({ queryKey: communityQueryKeys.mySubscriptions() });
      queryClient.invalidateQueries({ queryKey: communityQueryKeys.myMembership(slug) });
      queryClient.invalidateQueries({ queryKey: communityQueryKeys.bySlug(slug) });
    },
  });
}

export function useLeaveCommunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["post", "/api/community/{slug}/leave"],
    mutationFn: async (slug: string) => {
      return unwrapRestData(
        await apiClient.POST("/api/community/{slug}/leave", {
          params: { path: { slug } },
        }),
      );
    },
    onSuccess: (_data, slug) => {
      queryClient.invalidateQueries({ queryKey: communityQueryKeys.mySubscriptions() });
      queryClient.invalidateQueries({ queryKey: communityQueryKeys.myMembership(slug) });
      queryClient.invalidateQueries({ queryKey: communityQueryKeys.bySlug(slug) });
    },
  });
}
