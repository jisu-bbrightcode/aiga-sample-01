/**
 * Community Comment Hooks
 */

import type { operations } from "@repo/api-client";
import { sessionAtom } from "@repo/core/auth";
import type { InfiniteData, Query } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { $api, apiClient } from "@/lib/api";
import { getApiPathParams, getApiQueryParams, isApiQueryKey } from "../utils/query-key";
import {
  getPostByIdQueryKey,
  POST_BY_ID_BASE_QUERY_KEY,
  POST_COMMENTS_BASE_QUERY_KEY,
} from "./useCommunityPost";

// ---------------------------------------------------------------------------
// Local types
// ---------------------------------------------------------------------------
type CreateCommentBody =
  operations["CommunityController_createComment"]["requestBody"]["content"]["application/json"];
type UpdateCommentBody =
  operations["CommunityController_updateComment"]["requestBody"]["content"]["application/json"];
type CommentListResponse =
  operations["CommunityController_postComments"]["responses"][200]["content"]["application/json"];
type CommentResponse = CommentListResponse["items"][number];

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function usePostComments(postId: string, sort?: "old" | "new") {
  return $api.useInfiniteQuery(
    "get",
    "/api/community/posts/{id}/comments",
    {
      params: {
        path: { id: postId },
        query: { sort: sort ?? "old" },
      },
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      initialPageParam: undefined as string | undefined,
    },
  );
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateComment() {
  const queryClient = useQueryClient();
  const session = useAtomValue(sessionAtom);

  return useMutation({
    mutationKey: ["post", "/api/community/comments"],
    mutationFn: async (input: CreateCommentBody) => {
      const { data, error } = await apiClient.POST("/api/community/comments", { body: input });
      if (error) throw error;
      if (!data) throw new Error("community_comment_create_empty_response");
      return data;
    },
    onMutate: async (input) => {
      const commentsFilter = {
        predicate: (query: Query) => isPostCommentsQuery(query.queryKey, input.postId),
      };

      await queryClient.cancelQueries(commentsFilter);
      await queryClient.cancelQueries({ queryKey: getPostByIdQueryKey(input.postId) });

      const previousComments =
        queryClient.getQueriesData<InfiniteData<CommentListResponse>>(commentsFilter);
      const previousPost = queryClient.getQueryData(getPostByIdQueryKey(input.postId));
      const optimisticComment = createOptimisticComment(input, session);

      for (const [queryKey] of previousComments) {
        queryClient.setQueryData<InfiniteData<CommentListResponse>>(queryKey, (old) =>
          insertCommentIntoList(old, optimisticComment, getPostCommentsSort(queryKey)),
        );
      }
      queryClient.setQueryData<{ commentCount: number } | undefined>(
        getPostByIdQueryKey(input.postId),
        (old) => (old ? { ...old, commentCount: old.commentCount + 1 } : old),
      );

      return { previousComments, previousPost };
    },
    onError: (_err, input, context) => {
      for (const [queryKey, data] of context?.previousComments ?? []) {
        queryClient.setQueryData(queryKey, data);
      }
      if (context?.previousPost) {
        queryClient.setQueryData(getPostByIdQueryKey(input.postId), context.previousPost);
      }
    },
    onSettled: (_data, _err, input) => {
      queryClient.invalidateQueries({ queryKey: POST_COMMENTS_BASE_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: getPostByIdQueryKey(input.postId) });
    },
  });
}

function isPostCommentsQuery(queryKey: readonly unknown[], postId: string) {
  return (
    isApiQueryKey(queryKey, "get", "/api/community/posts/{id}/comments") &&
    getApiPathParams(queryKey)?.id === postId
  );
}

function getPostCommentsSort(queryKey: readonly unknown[]): "old" | "new" {
  return getApiQueryParams(queryKey)?.sort === "new" ? "new" : "old";
}

function createOptimisticComment(input: CreateCommentBody, session: unknown): CommentResponse {
  const user = (session as { user?: { id?: string; name?: string | null; email?: string | null } })
    ?.user;
  const now = new Date().toISOString();

  return {
    id: `optimistic-${crypto.randomUUID()}`,
    postId: input.postId,
    authorId: user?.id ?? "optimistic-user",
    authorName: user?.name ?? user?.email ?? "나",
    authorAvatar: null,
    parentId: input.parentId ?? null,
    content: input.content,
    depth: input.parentId ? 1 : 0,
    isDeleted: false,
    isRemoved: false,
    removalReason: null,
    removedBy: null,
    isEdited: false,
    editedAt: null,
    upvoteCount: 0,
    downvoteCount: 0,
    voteScore: 0,
    replyCount: 0,
    isStickied: false,
    distinguished: null,
    isHidden: false,
    createdAt: now,
    updatedAt: now,
  };
}

function insertCommentIntoList(
  old: InfiniteData<CommentListResponse> | undefined,
  optimisticComment: CommentResponse,
  sort: "old" | "new",
) {
  if (!old?.pages?.length) return old;

  return {
    ...old,
    pages: old.pages.map((page, pageIndex) => {
      const itemsWithParentCount = (page.items ?? []).map((item) =>
        item.id === optimisticComment.parentId
          ? { ...item, replyCount: item.replyCount + 1 }
          : item,
      );
      if (pageIndex !== 0) return { ...page, items: itemsWithParentCount };

      const items =
        sort === "new"
          ? [optimisticComment, ...itemsWithParentCount]
          : [...itemsWithParentCount, optimisticComment];

      return { ...page, items };
    }),
  };
}

export function useUpdateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["put", "/api/community/comments/{id}"],
    mutationFn: async (input: { id: string; data: UpdateCommentBody }) => {
      const { data, error } = await apiClient.PUT("/api/community/comments/{id}", {
        params: { path: { id: input.id } },
        body: input.data,
      });
      if (error) throw error;
      if (!data) throw new Error("community_comment_update_empty_response");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: POST_COMMENTS_BASE_QUERY_KEY });
    },
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();
  let optimisticContext: {
    previousComments: [readonly unknown[], unknown][];
  } | null = null;

  return useMutation({
    mutationKey: ["delete", "/api/community/comments/{id}"],
    mutationFn: async (id: string) => {
      const { data, error } = await apiClient.DELETE("/api/community/comments/{id}", {
        params: { path: { id } },
      });
      if (error) throw error;
      if (!data) throw new Error("community_comment_delete_empty_response");
      return data;
    },
    onMutate: async (commentId) => {
      await queryClient.cancelQueries({ queryKey: POST_COMMENTS_BASE_QUERY_KEY });
      const previousComments = queryClient.getQueriesData({
        queryKey: POST_COMMENTS_BASE_QUERY_KEY,
      });

      queryClient.setQueriesData<InfiniteData<CommentListResponse>>(
        { queryKey: POST_COMMENTS_BASE_QUERY_KEY },
        (old) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: (page.items ?? []).filter((item) => item.id !== commentId),
            })),
          };
        },
      );

      optimisticContext = { previousComments };
      return undefined;
    },
    onError: () => {
      if (optimisticContext?.previousComments) {
        for (const [queryKey, data] of optimisticContext.previousComments) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSettled: () => {
      optimisticContext = null;
      queryClient.invalidateQueries({ queryKey: POST_COMMENTS_BASE_QUERY_KEY });
      // Server decrements post.commentCount on delete; invalidate post-detail so commentCount stays fresh (finding #1)
      queryClient.invalidateQueries({ queryKey: POST_BY_ID_BASE_QUERY_KEY });
    },
  });
}
