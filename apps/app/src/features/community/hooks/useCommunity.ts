/**
 * Community Hooks
 */

import type { operations } from "@repo/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { $api, apiClient } from "@/lib/api";

// ---------------------------------------------------------------------------
// Local types
// ---------------------------------------------------------------------------
type CreateCommunityBody =
  operations["CommunityController_create"]["requestBody"]["content"]["application/json"];

// ---------------------------------------------------------------------------
// Query key constants
// ---------------------------------------------------------------------------
export const COMMUNITY_LIST_QUERY_KEY = ["get", "/api/community"] as const;
export const COMMUNITY_POPULAR_QUERY_KEY = ["get", "/api/community/popular"] as const;
export const COMMUNITY_MY_SUBSCRIPTIONS_QUERY_KEY = [
  "get",
  "/api/community/me/subscriptions",
] as const;

export function getCommunityBySlugQueryKey(slug: string) {
  return ["get", "/api/community/{slug}", { params: { path: { slug } } }] as const;
}

export function getCommunityMembershipQueryKey(slug: string) {
  return ["get", "/api/community/me/membership/{slug}", { params: { path: { slug } } }] as const;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateCommunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["post", "/api/community"],
    mutationFn: async (input: CreateCommunityBody) => {
      const { data, error } = await apiClient.POST("/api/community", { body: input });
      if (error) throw error;
      return data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COMMUNITY_LIST_QUERY_KEY });
    },
  });
}

export function useJoinCommunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["post", "/api/community/{slug}/join"],
    mutationFn: async (slug: string) => {
      const { data, error } = await apiClient.POST("/api/community/{slug}/join", {
        params: { path: { slug } },
      });
      if (error) throw error;
      return data!;
    },
    onSuccess: (_data, slug) => {
      queryClient.invalidateQueries({ queryKey: COMMUNITY_MY_SUBSCRIPTIONS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: getCommunityMembershipQueryKey(slug) });
      queryClient.invalidateQueries({ queryKey: getCommunityBySlugQueryKey(slug) });
    },
  });
}

export function useLeaveCommunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["post", "/api/community/{slug}/leave"],
    mutationFn: async (slug: string) => {
      const { data, error } = await apiClient.POST("/api/community/{slug}/leave", {
        params: { path: { slug } },
      });
      if (error) throw error;
      return data!;
    },
    onSuccess: (_data, slug) => {
      queryClient.invalidateQueries({ queryKey: COMMUNITY_MY_SUBSCRIPTIONS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: getCommunityMembershipQueryKey(slug) });
      queryClient.invalidateQueries({ queryKey: getCommunityBySlugQueryKey(slug) });
    },
  });
}
