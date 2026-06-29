export type ReactionType = "like" | "love" | "haha" | "wow" | "sad" | "angry";

export interface ReactionTypeCount {
  type: ReactionType;
  count: number;
}

export interface ReactionCounts {
  total: number;
  byType: ReactionTypeCount[];
}

export type NotificationType =
  | "comment"
  | "like"
  | "follow"
  | "mention"
  | "system"
  | "announcement";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  content?: string | null;
  data?: unknown;
  readAt?: Date | string | null;
  createdAt: Date | string;
  updatedAt?: Date | string;
}

export interface NotificationListFilters {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
  type?: NotificationType;
}
