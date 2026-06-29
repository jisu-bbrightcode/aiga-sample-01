import { authenticatedAtom } from "@repo/core/auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { useWidgetsApi } from "../common/api-context";
import { widgetQueryKeys } from "../common/query-keys";
import type { ReactionType } from "../common/types";
import { ReactionBar } from "./components/reaction-bar";

interface ReactionSectionProps {
  targetType: string;
  targetId: string;
  className?: string;
}

export function ReactionSection({ targetType, targetId, className }: ReactionSectionProps) {
  const api = useWidgetsApi();
  const queryClient = useQueryClient();
  const isAuthenticated = useAtomValue(authenticatedAtom);
  const hasTarget = !!targetType && !!targetId;

  const countsQuery = useQuery({
    queryKey: widgetQueryKeys.reaction.counts(targetType || "", targetId || ""),
    queryFn: async () => {
      const { data, error } = await api.GET("/api/reaction/counts", {
        params: { query: { targetType: targetType || "", targetId: targetId || "" } },
      });
      if (error) throw error;
      return data;
    },
    enabled: hasTarget,
  });

  const userStatusQuery = useQuery({
    queryKey: widgetQueryKeys.reaction.userStatus(targetType || "", targetId || ""),
    queryFn: async () => {
      const { data, error } = await api.GET("/api/reaction/user-status", {
        params: { query: { targetType: targetType || "", targetId: targetId || "" } },
      });
      if (error) throw error;
      return data;
    },
    enabled: hasTarget && !!isAuthenticated,
  });

  const toggleMutation = useMutation({
    mutationFn: async (input: { targetType: string; targetId: string; type: ReactionType }) => {
      const { data, error } = await api.POST("/api/reaction/toggle", { body: input });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      if (!hasTarget) return;
      queryClient.invalidateQueries({
        queryKey: widgetQueryKeys.reaction.counts(targetType, targetId),
      });
      queryClient.invalidateQueries({
        queryKey: widgetQueryKeys.reaction.userStatus(targetType, targetId),
      });
    },
  });

  if (!hasTarget) return null;

  const handleToggle = (type: ReactionType) => {
    if (!isAuthenticated) return;
    toggleMutation.mutate({ targetType, targetId, type });
  };

  return (
    <ReactionBar
      counts={countsQuery.data?.byType ?? []}
      userTypes={userStatusQuery.data?.types ?? []}
      onToggle={handleToggle}
      loading={toggleMutation.isPending}
      disabled={!isAuthenticated}
      className={className}
    />
  );
}
