/**
 * Story Feature — Mutation Hooks (DataBackend 경유 + Optimistic Update)
 *
 * 패턴: onMutate 캐시 즉시 갱신 → UI 반영 → 서버 write → onSettled 동기화
 * 백엔드는 DataProvider 의 DataBackend 로 주입한다.
 *
 * biome-ignore-all lint/suspicious/noExplicitAny: factory generic erasure (DataBackend 의 14 도메인 method).
 * biome-ignore-all lint/suspicious/useAwait: react-query mutationFn 시그니처는 Promise 반환 강제 — 본문이 sync 인 mutation 도 async 선언.
 * biome-ignore-all lint/style/noNonNullAssertion: ctx 검사 후 narrowed access.
 * biome-ignore-all lint/complexity/noExcessiveCognitiveComplexity: useMutation hook 의 onMutate/onError/onSettled 복합 (이전 apps/app 위치에선 통과).
 */

import { broadcastEntityChange } from "@repo/data/broadcast";
import { useDataBackend } from "@repo/data/provider";
import type {
  UploadEntityImageSmallInput,
} from "@repo/data/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import type { StoryDomainKey } from "./use-story-domains";

function useProjectId(): string {
  const { projectId } = useParams({ strict: false }) as { projectId?: string };
  if (!projectId) throw new Error("projectId not found in route params");
  return projectId;
}

// ─── Optimistic Create Helper ─────────────────────────────
// 모든 엔티티 create에 공통 적용

type CreateMutationCtx = {
  prevEntries: [readonly unknown[], unknown][];
  key: readonly unknown[];
  optimisticId: string;
  projectId: string;
};

export function useOptimisticCreate<
  TInput extends { name?: string; title?: string; description?: string; projectId?: string },
>(
  entityKey: string,
  // backend.<entity>.create 의 strict input 시그니처가 TInput(loose) 보다 좁아서
  // useOptimisticCreate generic 명시 후 호출부에서 mismatch.
  // createFn 안에서 캐스팅을 처리하므로 여기선 input: any 로 받음.
  createFn: (projectId: string, input: any) => Promise<unknown>,
) {
  const qc = useQueryClient();
  const pid = useProjectId();

  return useMutation<unknown, unknown, TInput, CreateMutationCtx>({
    mutationFn: async (input: TInput) => {
      const t = performance.now();
      const r = await createFn(input.projectId ?? pid, input);
      const ms = performance.now() - t;
      // FLT-317 진단 — mutationFn cold 식별 (>50ms 만 로깅)
      if (ms > 50) console.log(`[perf-mutate] ${entityKey}.mutationFn=${ms.toFixed(0)}ms`);
      return r;
    },
    onMutate: async (input) => {
      const projectId = input.projectId ?? pid;
      const key = ["story", entityKey, projectId];
      await qc.cancelQueries({ queryKey: key });
      const prevEntries = qc.getQueriesData({ queryKey: key });
      const optimisticId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? `temp-${crypto.randomUUID()}`
          : `temp-${Date.now()}`;
      const optimistic = {
        id: optimisticId,
        projectId,
        name: input.name ?? input.title ?? "",
        description: input.description ?? null,
        body: null,
        ownerId: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...input,
      };

      if (prevEntries.length === 0) {
        qc.setQueryData(key, [optimistic]);
      } else {
        for (const [queryKey, data] of prevEntries) {
          if (!Array.isArray(data)) continue;
          qc.setQueryData(queryKey, [optimistic, ...data]);
        }
      }

      return { prevEntries, key, optimisticId, projectId };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.prevEntries) {
        for (const [queryKey, data] of ctx.prevEntries) {
          qc.setQueryData(queryKey, data);
        }
      }
    },
    onSettled: (
      result,
      error,
      _input,
      ctx: { optimisticId?: string; projectId?: string } | undefined,
    ) => {
      qc.invalidateQueries({ queryKey: ["story", entityKey], refetchType: "active" });
      if (!error && ctx?.projectId) {
        const id = (result as { id?: string } | null | undefined)?.id;
        broadcastEntityChange(entityKey, "create", ctx.projectId, id);
      }
    },
  });
}

type UpdateVars = { id: string } & Record<string, unknown>;
type UpdateMutationCtx = {
  prev?: unknown;
  detailKey?: readonly unknown[];
  prevLists?: [readonly unknown[], unknown][];
};

export function useOptimisticUpdate(
  entityKey: string,
  updateFn: (id: string, input: Record<string, unknown>) => Promise<unknown>,
) {
  const qc = useQueryClient();
  return useMutation<unknown, unknown, UpdateVars, UpdateMutationCtx>({
    mutationFn: ({ id, ...input }) => updateFn(id, input),
    onMutate: async ({ id, ...input }) => {
      const detailKey = ["story", entityKey.replace(/s$/, ""), id];
      await qc.cancelQueries({ queryKey: detailKey });
      const prev = qc.getQueryData(detailKey);
      const updatedAt = new Date().toISOString();
      if (prev) {
        qc.setQueryData(detailKey, (old: any) => ({ ...old, ...input, updatedAt }));
      }

      // 사이드바 staleness 픽스 — list 캐시도 같이 갱신.
      // 모든 search/sortBy variant 매칭 (prefix ["story", entityKey, ...]).
      const listEntries = qc.getQueriesData({ queryKey: ["story", entityKey] });
      const prevLists: [readonly unknown[], unknown][] = [];
      for (const [queryKey, data] of listEntries) {
        if (!Array.isArray(data)) continue;
        prevLists.push([queryKey, data]);
        qc.setQueryData(
          queryKey,
          data.map((item: any) => (item?.id === id ? { ...item, ...input, updatedAt } : item)),
        );
      }
      return { prev, detailKey, prevLists };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.prev && ctx?.detailKey) qc.setQueryData(ctx.detailKey, ctx.prev);
      if (ctx?.prevLists) {
        for (const [queryKey, data] of ctx.prevLists) qc.setQueryData(queryKey, data);
      }
    },
    onSettled: (_d, error, vars) => {
      qc.invalidateQueries({ queryKey: ["story", entityKey], refetchType: "active" });
      qc.invalidateQueries({
        queryKey: ["story", entityKey.replace(/s$/, "")],
        refetchType: "active",
      });
      if (!error && vars?.id) broadcastEntityChange(entityKey, "update", "", vars.id);
    },
  });
}

type DeleteMutationCtx = { prevMap?: Map<string, unknown> };

export function useOptimisticDelete(
  entityKey: string,
  deleteFn: (id: string) => Promise<unknown>,
  _projectId?: string,
) {
  const qc = useQueryClient();
  return useMutation<unknown, unknown, string, DeleteMutationCtx>({
    mutationFn: (id) => deleteFn(id),
    onMutate: async (id) => {
      // DataBackend query cache 에서 즉시 제거.
      const listKeys = qc.getQueriesData({ queryKey: ["story", entityKey] });
      const prevMap = new Map<string, unknown>();
      for (const [key, data] of listKeys) {
        if (Array.isArray(data)) {
          prevMap.set(JSON.stringify(key), data);
          qc.setQueryData(
            key,
            data.filter((item: any) => item.id !== id),
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
    onSettled: (_d, error, id) => {
      qc.invalidateQueries({ queryKey: ["story", entityKey], refetchType: "active" });
      if (!error && typeof id === "string") {
        broadcastEntityChange(entityKey, "delete", "", id);
      }
    },
  });
}

// ============================================================================
// Domain Factory — STORY_DOMAINS metadata 위 generic CRUD hook
//   useDomainCreate / useDomainUpdate / useDomainDelete + useDomainCRUD 묶음
// ============================================================================

export function useDomainCreate<K extends StoryDomainKey>(key: K) {
  const backend = useDataBackend();
  // biome-ignore lint/suspicious/noExplicitAny: backend[K] strict input 가 generic 보다 좁음
  return useOptimisticCreate<any>(key, (pid, input) => backend[key].create(pid, input));
}

export function useDomainUpdate<K extends StoryDomainKey>(key: K) {
  const backend = useDataBackend();
  return useOptimisticUpdate(key, (id, input) => backend[key].update(id, input));
}

export function useDomainDelete<K extends StoryDomainKey>(key: K, projectId?: string) {
  const backend = useDataBackend();
  return useOptimisticDelete(key, (id) => backend[key].delete(id), projectId);
}

/**
 * 한 도메인 CRUD 3 mutation 묶음. 컴포넌트는
 * `const { create, update, remove } = useDomainCRUD("worlds")` 한 줄로 사용.
 */
export function useDomainCRUD<K extends StoryDomainKey>(key: K) {
  return {
    create: useDomainCreate(key),
    update: useDomainUpdate(key),
    remove: useDomainDelete(key),
  };
}

/**
 * 5 도메인 create mutation 모두 한 번에 lookup table 로 반환.
 * 컴포넌트가 dialog/picker 의 동적 entityType 으로 dispatch 할 때 사용.
 *   const creates = useAllDomainCreates();
 *   creates[selectedType].mutate(input);
 */
export function useAllDomainCreates() {
  return {
    worlds: useDomainCreate("worlds"),
    characters: useDomainCreate("characters"),
    locations: useDomainCreate("locations"),
    factions: useDomainCreate("factions"),
    codex: useDomainCreate("codex"),
  } as const;
}

export function useAllDomainUpdates() {
  return {
    worlds: useDomainUpdate("worlds"),
    characters: useDomainUpdate("characters"),
    locations: useDomainUpdate("locations"),
    factions: useDomainUpdate("factions"),
    codex: useDomainUpdate("codex"),
  } as const;
}

export function useAllDomainDeletes(projectId?: string) {
  return {
    worlds: useDomainDelete("worlds", projectId),
    characters: useDomainDelete("characters", projectId),
    locations: useDomainDelete("locations", projectId),
    factions: useDomainDelete("factions", projectId),
    codex: useDomainDelete("codex", projectId),
  } as const;
}

// ============================================================================
// Lore 도메인 Mutations — backwards-compat alias (호출처 그대로 유지)
// ============================================================================

export function useCreateWorld() {
  return useDomainCreate("worlds");
}
export function useUpdateWorld() {
  return useDomainUpdate("worlds");
}
export function useDeleteWorld() {
  return useDomainDelete("worlds");
}

export function useCreateCharacter() {
  return useDomainCreate("characters");
}
export function useUpdateCharacter() {
  return useDomainUpdate("characters");
}
export function useDeleteCharacter() {
  return useDomainDelete("characters");
}

export function useCreateLocation() {
  return useDomainCreate("locations");
}
export function useUpdateLocation() {
  return useDomainUpdate("locations");
}
export function useDeleteLocation() {
  return useDomainDelete("locations");
}

export function useCreateFaction() {
  return useDomainCreate("factions");
}
export function useUpdateFaction() {
  return useDomainUpdate("factions");
}
export function useDeleteFaction() {
  return useDomainDelete("factions");
}

export function useCreateCodexEntry() {
  return useDomainCreate("codex");
}
export function useUpdateCodexEntry() {
  return useDomainUpdate("codex");
}
export function useDeleteCodexEntry() {
  return useDomainDelete("codex");
}

export function useUploadEntityImageSmall() {
  const backend = useDataBackend();
  const qc = useQueryClient();
  return useMutation<{ imageSmallUrl: string }, unknown, UploadEntityImageSmallInput>({
    mutationFn: (input) => backend.entityProperties.uploadImageSmall(input),
    onSettled: (_result, error, input) => {
      if (error) return;
      qc.invalidateQueries({
        queryKey: ["story", "entityProperties", input.entityId, input.entityType],
        refetchType: "active",
      });
    },
  });
}

// ============================================================================
// Draft Mutations
// ============================================================================

export function useCreateDraft() {
  const backend = useDataBackend();
  return useOptimisticCreate("drafts", (pid, input) => backend.drafts.create(pid, input));
}

export function useUpdateDraft() {
  const backend = useDataBackend();
  return useOptimisticUpdate("drafts", (id, input) => backend.drafts.update(id, input));
}

export function useDeleteDraft() {
  const backend = useDataBackend();
  return useOptimisticDelete("drafts", (id) => backend.drafts.delete(id));
}

// ============================================================================
// Re-exports from remote mutations (Tags, EntityTags, Relations)
// ============================================================================

export {
  useAddEntityTag,
  useCreateRelation,
  useCreateTag,
  useDeleteRelation,
  useDeleteTag,
  useRemoveEntityTag,
} from "./use-story-mutations-remote";
