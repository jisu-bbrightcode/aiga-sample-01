/**
 * EntityTag, Relation 쿼리 — DataBackend 경유
 * (remote 직접 호출에서 전환됨 2026-04-17)
 */

import { useDataBackend } from "@repo/data/provider";
import { useQuery } from "@tanstack/react-query";

const STALE_DETAIL = 2 * 60 * 1000;

export function useEntityTags(
  entityId: string,
  entityType: "world" | "character" | "location" | "faction" | "codex",
) {
  const backend = useDataBackend();
  return useQuery({
    queryKey: ["story", "entityTags", entityId, entityType],
    queryFn: () => backend.entityTags.list(entityId, entityType),
    enabled: !!entityId,
    staleTime: STALE_DETAIL,
  });
}

export function useRelations(
  entityId: string,
  entityType: "world" | "character" | "location" | "faction" | "codex",
) {
  const backend = useDataBackend();
  return useQuery({
    queryKey: ["story", "relations", entityId, entityType],
    queryFn: () => backend.relations.list(entityId, entityType),
    enabled: !!entityId,
    staleTime: STALE_DETAIL,
  });
}
