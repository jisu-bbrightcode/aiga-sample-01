/**
 * Comment Query Hooks - REST 기반 댓글 조회
 */

import { useQuery } from "@tanstack/react-query";
import { useWidgetsApi } from "../../common/api-context";
import { widgetQueryKeys } from "../../common/query-keys";
import type { CommentTargetType, CommentWithAuthor } from "../types";

/**
 * 최상위 댓글 목록 조회
 */
export function useComments(
  targetType: CommentTargetType,
  targetId: string,
  options?: { page?: number; limit?: number },
) {
  const api = useWidgetsApi();
  const page = options?.page ?? 1;
  const limit = options?.limit ?? 20;

  return useQuery({
    queryKey: widgetQueryKeys.comment.list({ targetType, targetId, page, limit }),
    queryFn: async () => {
      const { data, error } = await api.GET("/api/comment", {
        params: { query: { targetType, targetId, page, limit } },
      });
      if (error) throw error;
      return data;
    },
  });
}

/**
 * 대댓글 목록 조회
 */
export function useCommentReplies(
  parentId: string | null,
  options?: { page?: number; limit?: number; enabled?: boolean },
) {
  const api = useWidgetsApi();
  const limit = options?.limit ?? 20;

  return useQuery({
    queryKey: widgetQueryKeys.comment.replies({ parentId: parentId ?? "", limit }),
    queryFn: async () => {
      const { data, error } = await api.GET("/api/comment/replies/{parentId}", {
        params: { path: { parentId: parentId ?? "" }, query: { limit } },
      });
      if (error) throw error;
      const items = (data ?? []) as CommentWithAuthor[];
      return {
        items,
        total: items.length,
        page: options?.page ?? 1,
        limit,
        hasMore: items.length >= limit,
      };
    },
    enabled: !!parentId && (options?.enabled ?? true),
  });
}

/**
 * 댓글 개수 조회
 */
export function useCommentCount(targetType: CommentTargetType, targetId: string) {
  const api = useWidgetsApi();

  return useQuery({
    queryKey: widgetQueryKeys.comment.count(targetType, targetId),
    queryFn: async () => {
      const { data, error } = await api.GET("/api/comment/count", {
        params: { query: { targetType, targetId } },
      });
      if (error) throw error;
      return data;
    },
  });
}
