/**
 * Community Feed Hooks
 */
import { $api } from "@/lib/api";

interface FeedOptions {
  sort?: "hot" | "new" | "top" | "rising" | "controversial";
  timeFilter?: "hour" | "day" | "week" | "month" | "year" | "all";
  page?: number;
  limit?: number;
}

export function useHomeFeed(options?: FeedOptions) {
  return $api.useQuery("get", "/api/community/feed/home", {
    params: {
      query: {
        sort: options?.sort ?? "hot",
        timeFilter: options?.timeFilter ?? "day",
        page: options?.page ?? 1,
        limit: options?.limit ?? 25,
      },
    },
  });
}

export function useAllFeed(options?: FeedOptions) {
  return $api.useQuery("get", "/api/community/feed/all", {
    params: {
      query: {
        sort: options?.sort ?? "hot",
        timeFilter: options?.timeFilter ?? "day",
        page: options?.page ?? 1,
        limit: options?.limit ?? 25,
      },
    },
  });
}

export function usePopularFeed(options?: {
  timeFilter?: "hour" | "day" | "week" | "month" | "year" | "all";
  limit?: number;
}) {
  return $api.useQuery("get", "/api/community/feed/popular", {
    params: {
      query: {
        timeFilter: options?.timeFilter ?? "day",
        limit: options?.limit ?? 25,
      },
    },
  });
}
