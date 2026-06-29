import { useQueries } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

export interface KarmaSummary {
  userId: string;
  postKarma: number;
  commentKarma: number;
  totalKarma: number;
}

const BATCH_SIZE = 50;

export function useKarma(userIds: string[]) {
  const uniqueIds = [...new Set(userIds)].sort();

  const chunks: string[][] = [];
  for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
    chunks.push(uniqueIds.slice(i, i + BATCH_SIZE));
  }

  const queries = useQueries({
    queries: chunks.map((chunk) => ({
      queryKey: ["get", "/api/community/karma/batch", { params: { query: { userIds: chunk.join(",") } } }] as const,
      queryFn: () =>
        apiClient
          .GET("/api/community/karma/batch", {
            params: { query: { userIds: chunk.join(",") } },
          })
          .then(({ data, error }) => {
            if (error) throw error;
            return data ?? [];
          }),
      staleTime: 5 * 60 * 1000,
      enabled: chunk.length > 0,
    })),
    combine: (results) => {
      const allData: KarmaSummary[] = [];
      let isLoading = false;

      for (const result of results) {
        if (result.isLoading) isLoading = true;
        if (result.data) {
          allData.push(...(result.data as KarmaSummary[]));
        }
      }

      const map = new Map<string, KarmaSummary>();
      for (const item of allData) {
        map.set(item.userId, item);
      }

      return { data: map, isLoading };
    },
  });

  return queries;
}
