/**
 * Community Comment Hooks
 */
import type { InfiniteData } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { $api, apiClient } from "@/lib/api";
import {
  type CommentListResponse,
  type CreateCommentBody,
  communityQueryKeys,
  type UpdateCommentBody,
  unwrapRestData,
} from "../api";

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

export function useCreateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["post", "/api/community/comments"],
    mutationFn: async (input: CreateCommentBody) => {
      return unwrapRestData(await apiClient.POST("/api/community/comments", { body: input }));
    },
    onSettled: (_data, _error, input) => {
      queryClient.invalidateQueries({ queryKey: communityQueryKeys.postCommentsBase() });
      queryClient.invalidateQueries({ queryKey: communityQueryKeys.postById(input.postId) });
    },
  });
}

export function useUpdateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["put", "/api/community/comments/{id}"],
    mutationFn: async (input: { id: string; data: UpdateCommentBody }) => {
      return unwrapRestData(
        await apiClient.PUT("/api/community/comments/{id}", {
          params: { path: { id: input.id } },
          body: input.data,
        }),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: communityQueryKeys.postCommentsBase() });
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
      return unwrapRestData(
        await apiClient.DELETE("/api/community/comments/{id}", {
          params: { path: { id } },
        }),
      );
    },
    onMutate: async (commentId) => {
      await queryClient.cancelQueries({ queryKey: communityQueryKeys.postCommentsBase() });
      const previousComments = queryClient.getQueriesData({
        queryKey: communityQueryKeys.postCommentsBase(),
      });

      queryClient.setQueriesData<InfiniteData<CommentListResponse>>(
        { queryKey: communityQueryKeys.postCommentsBase() },
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
      queryClient.invalidateQueries({ queryKey: communityQueryKeys.postCommentsBase() });
      queryClient.invalidateQueries({ queryKey: communityQueryKeys.postByIdBase() });
    },
  });
}
