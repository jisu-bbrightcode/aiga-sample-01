/**
 * Community Post Hooks
 */

import type { operations } from "@repo/api-client";
import { sessionAtom } from "@repo/core/auth";
import type { InfiniteData, Query } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { $api, apiClient } from "@/lib/api";
import { getApiQueryParams, isApiQueryKey } from "../utils/query-key";

// ---------------------------------------------------------------------------
// Local types
// ---------------------------------------------------------------------------
type CreatePostBody =
  operations["CommunityController_createPost"]["requestBody"]["content"]["application/json"];

/** Mutation input for useCreatePost — extends REST body with communitySlug for optimistic filter. */
type CreatePostInput = CreatePostBody & { communitySlug?: string };
type UpdatePostBody =
  operations["CommunityController_updatePost"]["requestBody"]["content"]["application/json"];
type CastVoteBody =
  operations["CommunityController_castVote"]["requestBody"]["content"]["application/json"];
type PostResponse =
  operations["CommunityController_postById"]["responses"][200]["content"]["application/json"];
type PostListResponse =
  operations["CommunityController_postList"]["responses"][200]["content"]["application/json"];
type FeedResponse =
  operations["CommunityController_feedAll"]["responses"][200]["content"]["application/json"];
type CommentListResponse =
  operations["CommunityController_postComments"]["responses"][200]["content"]["application/json"];
type PostListItem = PostListResponse["items"][number];
type FeedItem = FeedResponse["items"][number];
export type CommunityPostSort = "hot" | "new" | "top" | "rising" | "controversial";
export type CommunityPostListItem = PostListItem;
export type CommunityFeedItem = FeedItem;
interface VotableItem {
  id: string;
  voteScore: number;
  upvoteCount: number;
  downvoteCount: number;
  userVote?: number | null;
}

// ---------------------------------------------------------------------------
// Query key constants
// ---------------------------------------------------------------------------
export const POST_LIST_QUERY_KEY = ["get", "/api/community/posts"] as const;
export const HOME_FEED_QUERY_KEY = ["get", "/api/community/feed/home"] as const;
export const ALL_FEED_QUERY_KEY = ["get", "/api/community/feed/all"] as const;

/** Broad base key that prefix-matches all /posts/{id} entries (no id). */
export const POST_BY_ID_BASE_QUERY_KEY = ["get", "/api/community/posts/{id}"] as const;

export function getPostByIdQueryKey(id: string) {
  return ["get", "/api/community/posts/{id}", { params: { path: { id } } }] as const;
}

export function getPostCommentsQueryKey(id: string) {
  return ["get", "/api/community/posts/{id}/comments", { params: { path: { id } } }] as const;
}

// Broad key for invalidating all postComments entries (no id filter)
export const POST_COMMENTS_BASE_QUERY_KEY = ["get", "/api/community/posts/{id}/comments"] as const;

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useCommunityPosts(options: {
  communitySlug?: string;
  communityId?: string;
  sort?: CommunityPostSort;
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
          sort: options.sort,
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

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreatePost() {
  const queryClient = useQueryClient();
  const session = useAtomValue(sessionAtom);

  return useMutation({
    mutationKey: ["post", "/api/community/posts"],
    mutationFn: async (input: CreatePostInput) => {
      // Strip communitySlug — it is UI-only and not part of the REST body
      const { communitySlug: _slug, ...body } = input;
      const { data, error } = await apiClient.POST("/api/community/posts", { body });
      if (error) throw error;
      if (!data) throw new Error("community_post_create_empty_response");
      return data;
    },
    onMutate: async (input) => {
      const postListFilter = {
        predicate: (query: Query) => isMatchingPostListQuery(query.queryKey, input),
      };
      const feedFilter = {
        predicate: (query: Query) => isCommunityFeedQuery(query.queryKey),
      };

      await queryClient.cancelQueries(postListFilter);
      await queryClient.cancelQueries(feedFilter);

      const previousLists =
        queryClient.getQueriesData<InfiniteData<PostListResponse>>(postListFilter);
      const previousFeeds = queryClient.getQueriesData<FeedResponse>(feedFilter);
      const optimisticPost = createOptimisticPost(input, session);

      for (const [queryKey] of previousLists) {
        if (getPostListSort(queryKey) !== "new") continue;
        queryClient.setQueryData<InfiniteData<PostListResponse>>(queryKey, (old) =>
          insertPostIntoInfiniteList(old, optimisticPost),
        );
      }
      for (const [queryKey] of previousFeeds) {
        if (getFeedSort(queryKey) !== "new") continue;
        queryClient.setQueryData<FeedResponse>(queryKey, (old) =>
          insertPostIntoFeed(old, optimisticPost),
        );
      }

      return { previousLists, previousFeeds };
    },
    onError: (_err, _input, context) => {
      for (const [queryKey, data] of context?.previousLists ?? []) {
        queryClient.setQueryData(queryKey, data);
      }
      for (const [queryKey, data] of context?.previousFeeds ?? []) {
        queryClient.setQueryData(queryKey, data);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: POST_LIST_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: HOME_FEED_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ALL_FEED_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: POST_BY_ID_BASE_QUERY_KEY });
    },
  });
}

export function useUpdatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["put", "/api/community/posts/{id}"],
    mutationFn: async (input: { id: string; data: UpdatePostBody }) => {
      const { data, error } = await apiClient.PUT("/api/community/posts/{id}", {
        params: { path: { id: input.id } },
        body: input.data,
      });
      if (error) throw error;
      if (!data) throw new Error("community_post_update_empty_response");
      return data;
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: getPostByIdQueryKey(input.id) });
      queryClient.invalidateQueries({ queryKey: POST_LIST_QUERY_KEY });
    },
  });
}

export function useDeletePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["delete", "/api/community/posts/{id}"],
    mutationFn: async (id: string) => {
      const { data, error } = await apiClient.DELETE("/api/community/posts/{id}", {
        params: { path: { id } },
      });
      if (error) throw error;
      if (!data) throw new Error("community_post_delete_empty_response");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: POST_LIST_QUERY_KEY });
    },
  });
}

// ---------------------------------------------------------------------------
// Vote helpers
// ---------------------------------------------------------------------------

/**
 * Optimistic vote helper: compute deltas based on current userVote and new vote.
 *
 * Server semantics:
 * - same vote clicked → no-op (server ignores)
 * - new vote (no previous) → score ±1, increment up/down count
 * - flip vote (up↔down) → score ±2, swap up/down counts
 */
function computeVoteDeltas(
  currentUserVote: number | null | undefined,
  newVote: 1 | -1,
): { scoreDelta: number; upDelta: number; downDelta: number; newUserVote: number | null } {
  // Same vote → no-op
  if (currentUserVote === newVote) {
    return { scoreDelta: 0, upDelta: 0, downDelta: 0, newUserVote: currentUserVote };
  }

  // Flip vote
  if (currentUserVote === 1 && newVote === -1) {
    return { scoreDelta: -2, upDelta: -1, downDelta: 1, newUserVote: -1 };
  }
  if (currentUserVote === -1 && newVote === 1) {
    return { scoreDelta: 2, upDelta: 1, downDelta: -1, newUserVote: 1 };
  }

  // New vote (no previous)
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

function getCachedUserVote(item: VotableItem): number | null | undefined {
  return item.userVote;
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
      const { data, error } = await apiClient.POST("/api/community/votes", { body: input });
      if (error) throw error;
      if (!data) throw new Error("community_vote_empty_response");
      return data;
    },
    onMutate: (variables) => {
      void queryClient.cancelQueries({ queryKey: getPostByIdQueryKey(variables.targetId) });
      void queryClient.cancelQueries({ queryKey: POST_LIST_QUERY_KEY });
      void queryClient.cancelQueries({ queryKey: POST_COMMENTS_BASE_QUERY_KEY });

      const previousPost = queryClient.getQueryData(getPostByIdQueryKey(variables.targetId));
      const previousLists = queryClient.getQueriesData({ queryKey: POST_LIST_QUERY_KEY });
      const previousComments = queryClient.getQueriesData({
        queryKey: POST_COMMENTS_BASE_QUERY_KEY,
      });

      if (variables.targetType === "post") {
        queryClient.setQueryData<PostResponse | undefined>(
          getPostByIdQueryKey(variables.targetId),
          (old) => {
            if (!old) return old;
            const deltas = computeVoteDeltas(getCachedUserVote(old), variables.vote as 1 | -1);
            return applyVoteDelta(old, deltas);
          },
        );

        queryClient.setQueriesData<InfiniteData<PostListResponse>>(
          { queryKey: POST_LIST_QUERY_KEY },
          (old) => {
            if (!old?.pages) return old;
            return {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                items: page.items.map((item) => {
                  if (item.id !== variables.targetId) return item;
                  const deltas = computeVoteDeltas(
                    getCachedUserVote(item),
                    variables.vote as 1 | -1,
                  );
                  return applyVoteDelta(item, deltas);
                }),
              })),
            };
          },
        );
      }

      if (variables.targetType === "comment") {
        queryClient.setQueriesData<InfiniteData<CommentListResponse>>(
          { queryKey: POST_COMMENTS_BASE_QUERY_KEY },
          (old) => {
            if (!old?.pages) return old;
            return {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                items: page.items.map((item) => {
                  if (item.id !== variables.targetId) return item;
                  const deltas = computeVoteDeltas(
                    getCachedUserVote(item),
                    variables.vote as 1 | -1,
                  );
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
    onError: (_err, variables) => {
      if (optimisticContext?.previousPost) {
        queryClient.setQueryData(
          getPostByIdQueryKey(variables.targetId),
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
    onSettled: (_data, _err, variables) => {
      optimisticContext = null;
      queryClient.invalidateQueries({ queryKey: POST_LIST_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: getPostByIdQueryKey(variables.targetId) });
      queryClient.invalidateQueries({ queryKey: POST_COMMENTS_BASE_QUERY_KEY });
    },
  });
}

function isMatchingPostListQuery(queryKey: readonly unknown[], input: CreatePostInput) {
  if (!isApiQueryKey(queryKey, "get", "/api/community/posts")) return false;
  const query = getApiQueryParams(queryKey);
  if (input.communitySlug) return query?.communitySlug === input.communitySlug;
  if (input.communityId) return query?.communityId === input.communityId;
  return true;
}

function isCommunityFeedQuery(queryKey: readonly unknown[]) {
  return (
    isApiQueryKey(queryKey, "get", "/api/community/feed/home") ||
    isApiQueryKey(queryKey, "get", "/api/community/feed/all")
  );
}

function getPostListSort(queryKey: readonly unknown[]): CommunityPostSort {
  const sort = getApiQueryParams(queryKey)?.sort;
  return isCommunityPostSort(sort) ? sort : "new";
}

function getFeedSort(queryKey: readonly unknown[]): CommunityPostSort {
  const sort = getApiQueryParams(queryKey)?.sort;
  return isCommunityPostSort(sort) ? sort : "hot";
}

function isCommunityPostSort(value: unknown): value is CommunityPostSort {
  return (
    value === "hot" ||
    value === "new" ||
    value === "top" ||
    value === "rising" ||
    value === "controversial"
  );
}

function createOptimisticPost(input: CreatePostInput, session: unknown): FeedItem {
  const user = (session as { user?: { id?: string; name?: string | null; email?: string | null } })
    ?.user;
  const now = new Date().toISOString();

  return {
    id: `optimistic-${crypto.randomUUID()}`,
    communityId: input.communityId,
    communitySlug: input.communitySlug ?? null,
    authorId: user?.id ?? "optimistic-user",
    authorName: user?.name ?? user?.email ?? "나",
    authorAvatar: null,
    title: input.title,
    content: input.content ?? null,
    type: input.type,
    linkUrl: input.linkUrl ?? null,
    linkPreview: null,
    mediaUrls: input.mediaUrls ?? null,
    pollData: normalizePollData(input.pollData),
    flairId: input.flairId ?? null,
    isNsfw: input.isNsfw ?? false,
    isSpoiler: input.isSpoiler ?? false,
    isOc: input.isOc ?? false,
    contentRating: "general",
    status: "published",
    isPinned: false,
    isLocked: false,
    removalReason: null,
    removedBy: null,
    viewCount: 0,
    upvoteCount: 0,
    downvoteCount: 0,
    voteScore: 0,
    commentCount: 0,
    shareCount: 0,
    crosspostParentId: null,
    hotScore: 0,
    lastActivityAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

function insertPostIntoInfiniteList(
  old: InfiniteData<PostListResponse> | undefined,
  optimisticPost: PostListItem,
) {
  if (!old?.pages?.length) return old;
  return {
    ...old,
    pages: old.pages.map((page, index) =>
      index === 0
        ? {
            ...page,
            items: [optimisticPost, ...(page.items ?? [])],
          }
        : page,
    ),
  };
}

function insertPostIntoFeed(old: FeedResponse | undefined, optimisticPost: FeedItem) {
  if (!old?.items) return old;
  return {
    ...old,
    total: old.total + 1,
    items: [optimisticPost, ...old.items],
  };
}

function normalizePollData(input: CreatePostInput["pollData"]): FeedItem["pollData"] {
  if (!input) return null;
  return {
    options: (input.options ?? []).map((option) => ({
      id: option.id ?? crypto.randomUUID(),
      text: option.text ?? "",
      voteCount:
        "voteCount" in option && typeof option.voteCount === "number" ? option.voteCount : 0,
    })),
    multipleChoice: input.multipleChoice ?? false,
    expiresAt: input.expiresAt,
  };
}
