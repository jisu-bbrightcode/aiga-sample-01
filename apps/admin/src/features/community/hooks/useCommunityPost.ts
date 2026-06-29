/**
 * Community Post Hooks
 */
import type { InfiniteData } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { $api, apiClient } from "@/lib/api";
import {
  type CastVoteBody,
  type CommentListResponse,
  type CreatePostInput,
  communityQueryKeys,
  type PostListResponse,
  type PostResponse,
  resolveCommunityId,
  type UpdatePostBody,
  unwrapRestData,
} from "../api";

interface VotableItem {
  id: string;
  voteScore: number;
  upvoteCount: number;
  downvoteCount: number;
  userVote?: number | null;
}

export function useCommunityPosts(options: {
  communitySlug?: string;
  communityId?: string;
  limit?: number;
}) {
  return $api.useInfiniteQuery(
    "get",
    "/api/community/posts",
    {
      params: {
        query: {
          communitySlug: options.communitySlug,
          communityId: options.communityId,
          limit: options.limit,
        },
      },
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      initialPageParam: undefined as string | undefined,
    },
  );
}

export function useCommunityPost(id: string) {
  return $api.useQuery("get", "/api/community/posts/{id}", {
    params: { path: { id } },
  });
}

export function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["post", "/api/community/posts"],
    mutationFn: async (input: CreatePostInput) => {
      const communityId = await resolveCommunityId(input);
      const { communitySlug: _communitySlug, ...rest } = input;
      const body = { ...rest, communityId };
      return unwrapRestData(await apiClient.POST("/api/community/posts", { body }));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: communityQueryKeys.posts() });
      queryClient.invalidateQueries({ queryKey: communityQueryKeys.postByIdBase() });
    },
  });
}

export function useUpdatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["put", "/api/community/posts/{id}"],
    mutationFn: async (input: { id: string; data: UpdatePostBody }) => {
      return unwrapRestData(
        await apiClient.PUT("/api/community/posts/{id}", {
          params: { path: { id: input.id } },
          body: input.data,
        }),
      );
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: communityQueryKeys.postById(input.id) });
      queryClient.invalidateQueries({ queryKey: communityQueryKeys.posts() });
    },
  });
}

export function useDeletePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["delete", "/api/community/posts/{id}"],
    mutationFn: async (id: string) => {
      return unwrapRestData(
        await apiClient.DELETE("/api/community/posts/{id}", {
          params: { path: { id } },
        }),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: communityQueryKeys.posts() });
    },
  });
}

function computeVoteDeltas(
  currentUserVote: number | null | undefined,
  newVote: 1 | -1,
): { scoreDelta: number; upDelta: number; downDelta: number; newUserVote: number | null } {
  if (currentUserVote === newVote) {
    return { scoreDelta: 0, upDelta: 0, downDelta: 0, newUserVote: currentUserVote };
  }

  if (currentUserVote === 1 && newVote === -1) {
    return { scoreDelta: -2, upDelta: -1, downDelta: 1, newUserVote: -1 };
  }
  if (currentUserVote === -1 && newVote === 1) {
    return { scoreDelta: 2, upDelta: 1, downDelta: -1, newUserVote: 1 };
  }

  return {
    scoreDelta: newVote,
    upDelta: newVote === 1 ? 1 : 0,
    downDelta: newVote === -1 ? 1 : 0,
    newUserVote: newVote,
  };
}

function applyVoteDelta<T extends VotableItem>(
  item: T,
  deltas: ReturnType<typeof computeVoteDeltas>,
): T {
  return {
    ...item,
    voteScore: item.voteScore + deltas.scoreDelta,
    upvoteCount: Math.max(0, item.upvoteCount + deltas.upDelta),
    downvoteCount: Math.max(0, item.downvoteCount + deltas.downDelta),
    userVote: deltas.newUserVote,
  };
}

function getCachedUserVote(item: unknown): number | null | undefined {
  if (!item || typeof item !== "object" || !("userVote" in item)) return undefined;
  const userVote = (item as { userVote?: unknown }).userVote;
  return userVote === 1 || userVote === -1 || userVote === null ? userVote : undefined;
}

export function useVote() {
  const queryClient = useQueryClient();
  let optimisticContext: {
    previousPost: unknown;
    previousLists: [readonly unknown[], unknown][];
    previousComments: [readonly unknown[], unknown][];
  } | null = null;

  return useMutation({
    mutationKey: ["post", "/api/community/votes"],
    mutationFn: async (input: CastVoteBody) => {
      return unwrapRestData(await apiClient.POST("/api/community/votes", { body: input }));
    },
    onMutate: (variables) => {
      void queryClient.cancelQueries({ queryKey: communityQueryKeys.postById(variables.targetId) });
      void queryClient.cancelQueries({ queryKey: communityQueryKeys.posts() });
      void queryClient.cancelQueries({ queryKey: communityQueryKeys.postCommentsBase() });

      const previousPost = queryClient.getQueryData(
        communityQueryKeys.postById(variables.targetId),
      );
      const previousLists = queryClient.getQueriesData({ queryKey: communityQueryKeys.posts() });
      const previousComments = queryClient.getQueriesData({
        queryKey: communityQueryKeys.postCommentsBase(),
      });

      if (variables.targetType === "post") {
        queryClient.setQueryData<PostResponse | undefined>(
          communityQueryKeys.postById(variables.targetId),
          (old) => {
            if (!old) return old;
            const deltas = computeVoteDeltas(getCachedUserVote(old), variables.vote);
            return applyVoteDelta(old, deltas);
          },
        );

        queryClient.setQueriesData<InfiniteData<PostListResponse>>(
          { queryKey: communityQueryKeys.posts() },
          (old) => {
            if (!old?.pages) return old;
            return {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                items: page.items.map((item) => {
                  if (item.id !== variables.targetId) return item;
                  const deltas = computeVoteDeltas(getCachedUserVote(item), variables.vote);
                  return applyVoteDelta(item, deltas);
                }),
              })),
            };
          },
        );
      }

      if (variables.targetType === "comment") {
        queryClient.setQueriesData<InfiniteData<CommentListResponse>>(
          { queryKey: communityQueryKeys.postCommentsBase() },
          (old) => {
            if (!old?.pages) return old;
            return {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                items: page.items.map((item) => {
                  if (item.id !== variables.targetId) return item;
                  const deltas = computeVoteDeltas(getCachedUserVote(item), variables.vote);
                  return applyVoteDelta(item, deltas);
                }),
              })),
            };
          },
        );
      }

      optimisticContext = { previousPost, previousLists, previousComments };
      return undefined;
    },
    onError: (_error, variables) => {
      if (optimisticContext?.previousPost) {
        queryClient.setQueryData(
          communityQueryKeys.postById(variables.targetId),
          optimisticContext.previousPost,
        );
      }
      if (optimisticContext?.previousLists) {
        for (const [queryKey, data] of optimisticContext.previousLists) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      if (optimisticContext?.previousComments) {
        for (const [queryKey, data] of optimisticContext.previousComments) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSettled: (_data, _error, variables) => {
      optimisticContext = null;
      queryClient.invalidateQueries({ queryKey: communityQueryKeys.posts() });
      queryClient.invalidateQueries({ queryKey: communityQueryKeys.postById(variables.targetId) });
      queryClient.invalidateQueries({ queryKey: communityQueryKeys.postCommentsBase() });
    },
  });
}
