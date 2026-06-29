/**
 * Tag, EntityTag, Relation Mutations — DataBackend 경유 + Optimistic Update
 *
 * 패턴: onMutate에서 캐시 즉시 갱신 → 서버 응답 대기 없이 UI 반영
 *       onError에서 롤백 → onSettled에서 최종 동기화
 *
 * biome-ignore-all lint/suspicious/useAwait: react-query mutationFn 시그니처가 Promise 반환 강제.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useDataBackend } from "@repo/data/provider";
import type { EntityTag, EntityType, Relation, Tag } from "@repo/data/types";

function useProjectId(): string {
  const { projectId } = useParams({ strict: false }) as { projectId?: string };
  if (!projectId) throw new Error("projectId not found in route params");
  return projectId;
}

// ─── Tags ─────────────────────────────────────────────────

export function useCreateTag() {
  const backend = useDataBackend();
  const qc = useQueryClient();
  const projectId = useProjectId();
  return useMutation({
    mutationFn: (input: { name: string; color?: string }) => backend.tags.create(projectId, input),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ["story", "tags", projectId] });
      const prev = qc.getQueryData<Tag[]>(["story", "tags", projectId]);
      const optimistic: Tag = {
        id: `temp-${Date.now()}`,
        projectId,
        name: input.name,
        color: input.color ?? null,
      };
      qc.setQueryData<Tag[]>(["story", "tags", projectId], (old) => [...(old ?? []), optimistic]);
      return { prev };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.prev) qc.setQueryData(["story", "tags", projectId], ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["story", "tags"] });
    },
  });
}

export function useDeleteTag() {
  const backend = useDataBackend();
  const qc = useQueryClient();
  const projectId = useProjectId();
  return useMutation({
    mutationFn: (id: string) => backend.tags.delete(id),
    onMutate: async (id) => {
      const key = ["story", "tags", projectId];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Tag[]>(key);
      qc.setQueryData<Tag[]>(key, (old) => (old ?? []).filter((t) => t.id !== id));
      return { prev, key };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["story", "tags"] });
    },
  });
}

// ─── Entity Tags ──────────────────────────────────────────

export function useAddEntityTag() {
  const backend = useDataBackend();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      entityId: string;
      entityType: EntityType;
      tagId: string;
      tagName?: string;
    }) =>
      backend.entityTags.add({
        entityId: input.entityId,
        entityType: input.entityType,
        tagId: input.tagId,
      }),
    onMutate: async (input) => {
      const key = ["story", "entityTags", input.entityId, input.entityType];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData(key);
      const optimistic = {
        id: `temp-${Date.now()}`,
        entityId: input.entityId,
        entityType: input.entityType,
        tagId: input.tagId,
        tag: { name: input.tagName ?? "", color: null },
      };
      qc.setQueryData(key, (old: unknown[]) => [...(old ?? []), optimistic]);
      return { prev, key };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.prev) qc.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: (_data, _err, input) => {
      qc.invalidateQueries({ queryKey: ["story", "entityTags", input.entityId] });
    },
  });
}

export function useRemoveEntityTag() {
  const backend = useDataBackend();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entityTagId: string) => backend.entityTags.remove(entityTagId),
    onMutate: async (entityTagId) => {
      // 모든 entityTags 캐시에서 즉시 제거
      const allKeys = qc.getQueriesData<EntityTag[]>({ queryKey: ["story", "entityTags"] });
      const prevMap = new Map<string, EntityTag[]>();
      for (const [key, data] of allKeys) {
        if (Array.isArray(data)) {
          prevMap.set(JSON.stringify(key), data);
          qc.setQueryData(
            key,
            data.filter((et) => et.id !== entityTagId),
          );
        }
      }
      return { prevMap };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prevMap) {
        for (const [keyStr, data] of ctx.prevMap) {
          qc.setQueryData(JSON.parse(keyStr), data);
        }
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["story", "entityTags"] });
    },
  });
}

// ─── Relations ────────────────────────────────────────────

export function useCreateRelation() {
  const backend = useDataBackend();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      sourceId: string;
      sourceType: EntityType;
      targetId: string;
      targetType: EntityType;
      targetName?: string;
      label?: string;
      projectId: string;
    }) => backend.relations.create(input),
    onMutate: async (input) => {
      const key = ["story", "relations", input.sourceId, input.sourceType];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData(key);
      const optimistic = {
        id: `temp-${Date.now()}`,
        sourceId: input.sourceId,
        sourceType: input.sourceType,
        targetId: input.targetId,
        targetType: input.targetType,
        targetEntityId: input.targetId,
        targetEntityType: input.targetType,
        targetEntityName: input.targetName ?? "",
        label: input.label ?? null,
        projectId: input.projectId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      qc.setQueryData(key, (old: unknown[]) => [...(old ?? []), optimistic]);
      return { prev, key };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.prev) qc.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: (_data, _err, input) => {
      qc.invalidateQueries({ queryKey: ["story", "relations", input.sourceId] });
    },
  });
}

export function useDeleteRelation() {
  const backend = useDataBackend();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => backend.relations.delete(id),
    onMutate: async (id) => {
      const allKeys = qc.getQueriesData<Relation[]>({ queryKey: ["story", "relations"] });
      const prevMap = new Map<string, Relation[]>();
      for (const [key, data] of allKeys) {
        if (Array.isArray(data)) {
          prevMap.set(JSON.stringify(key), data);
          qc.setQueryData(
            key,
            data.filter((r) => r.id !== id),
          );
        }
      }
      return { prevMap };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prevMap) {
        for (const [keyStr, data] of ctx.prevMap) {
          qc.setQueryData(JSON.parse(keyStr), data);
        }
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["story", "relations"] });
    },
  });
}
