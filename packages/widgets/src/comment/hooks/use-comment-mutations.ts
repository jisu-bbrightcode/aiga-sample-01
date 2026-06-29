/**
 * Comment Mutation Hooks - REST 기반 댓글 생성/수정/삭제
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useWidgetsApi } from "../../common/api-context";
import { widgetQueryKeys } from "../../common/query-keys";
import type { CommentTargetType } from "../types";

interface CommentMutationContext {
  targetType: CommentTargetType;
  targetId: string;
}

/**
 * 댓글 생성
 */
export function useCreateComment({ targetType, targetId }: CommentMutationContext) {
  const api = useWidgetsApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      targetType: CommentTargetType;
      targetId: string;
      content: string;
      parentId?: string;
      mentions?: string[];
    }) => {
      const { data, error } = await api.POST("/api/comment", { body: input });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: widgetQueryKeys.comment.listPrefix(targetType, targetId),
      });
      queryClient.invalidateQueries({
        queryKey: widgetQueryKeys.comment.count(targetType, targetId),
      });
    },
  });
}

/**
 * 댓글 수정
 */
export function useUpdateComment({ targetType, targetId }: CommentMutationContext) {
  const api = useWidgetsApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; data: { content: string; mentions?: string[] } }) => {
      const { data, error } = await api.PUT("/api/comment/{id}", {
        params: { path: { id: input.id } },
        body: input.data,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: widgetQueryKeys.comment.listPrefix(targetType, targetId),
      });
      // Also invalidate replies that may contain the updated comment
      queryClient.invalidateQueries({
        queryKey: widgetQueryKeys.comment.repliesPrefix(variables.id),
      });
    },
  });
}

/**
 * 댓글 삭제
 */
export function useDeleteComment({ targetType, targetId }: CommentMutationContext) {
  const api = useWidgetsApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string }) => {
      const { data, error } = await api.DELETE("/api/comment/{id}", {
        params: { path: { id: input.id } },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: widgetQueryKeys.comment.listPrefix(targetType, targetId),
      });
      queryClient.invalidateQueries({
        queryKey: widgetQueryKeys.comment.count(targetType, targetId),
      });
    },
  });
}
