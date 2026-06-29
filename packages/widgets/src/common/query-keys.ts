import type { CommentTargetType } from "../comment/types";
import type { NotificationListFilters } from "./types";

export const widgetQueryKeys = {
  comment: {
    listPrefix: (targetType: CommentTargetType, targetId: string) =>
      ["widgets", "comment", "list", targetType, targetId] as const,
    list: (input: {
      targetType: CommentTargetType;
      targetId: string;
      page: number;
      limit: number;
    }) =>
      [
        ...widgetQueryKeys.comment.listPrefix(input.targetType, input.targetId),
        input.page,
        input.limit,
      ] as const,
    repliesPrefix: (parentId: string) => ["widgets", "comment", "replies", parentId] as const,
    replies: (input: { parentId: string; limit: number }) =>
      [...widgetQueryKeys.comment.repliesPrefix(input.parentId), input.limit] as const,
    count: (targetType: CommentTargetType, targetId: string) =>
      ["widgets", "comment", "count", targetType, targetId] as const,
  },
  reaction: {
    counts: (targetType: string, targetId: string) =>
      ["widgets", "reaction", "counts", targetType, targetId] as const,
    userStatus: (targetType: string, targetId: string) =>
      ["widgets", "reaction", "user-status", targetType, targetId] as const,
  },
  notification: {
    listPrefix: () => ["widgets", "notification", "list"] as const,
    list: (
      filters: Required<Pick<NotificationListFilters, "page" | "limit" | "unreadOnly">> &
        Pick<NotificationListFilters, "type">,
    ) => [...widgetQueryKeys.notification.listPrefix(), filters] as const,
    unreadCount: () => ["widgets", "notification", "unread-count"] as const,
    settings: () => ["widgets", "notification", "settings"] as const,
  },
};
