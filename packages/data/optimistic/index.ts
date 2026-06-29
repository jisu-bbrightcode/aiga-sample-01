import { useSyncExternalStore } from "react";

// 호출자 generic 추론 호환을 위한 lax constraint — id 만 필수, 나머지는
// optional + index signature 로 자유. cross-package boundary 에서 호출자
// 의 narrow type (예: `{ id, name? }`) 도 호환.
interface OptimisticEntity {
  id: string;
  projectId?: string;
  name?: string;
  title?: string;
  description?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
  // biome-ignore lint/suspicious/noExplicitAny: 호출자 generic 호환 (LiveResultShape<unknown> 등)
  [key: string]: any;
}

const optimisticRows = new Map<string, OptimisticEntity[]>();
const optimisticDeletes = new Map<string, Set<string>>();
const listeners = new Map<string, Set<() => void>>();
const EMPTY_ROWS: OptimisticEntity[] = [];
const EMPTY_DELETES: Set<string> = new Set();

function buildKey(entityKey: string, projectId: string): string {
  return `${entityKey}:${projectId}`;
}

function emit(key: string): void {
  const subs = listeners.get(key);
  if (!subs) return;
  for (const listener of subs) listener();
}

function subscribe(key: string, listener: () => void): () => void {
  const subs = listeners.get(key) ?? new Set<() => void>();
  subs.add(listener);
  listeners.set(key, subs);

  return () => {
    const current = listeners.get(key);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) listeners.delete(key);
  };
}

export function addOptimisticEntity(
  entityKey: string,
  projectId: string,
  entity: OptimisticEntity,
): void {
  const key = buildKey(entityKey, projectId);
  const current = optimisticRows.get(key) ?? [];
  optimisticRows.set(
    key,
    [entity, ...current.filter((row) => row.id !== entity.id)],
  );
  emit(key);
}

export function removeOptimisticEntity(
  entityKey: string,
  projectId: string,
  entityId: string,
): void {
  const key = buildKey(entityKey, projectId);
  const current = optimisticRows.get(key);
  if (!current) return;

  const next = current.filter((row) => row.id !== entityId);
  if (next.length === 0) optimisticRows.delete(key);
  else optimisticRows.set(key, next);
  emit(key);
}

export function useOptimisticEntities<T extends OptimisticEntity>(
  entityKey: string,
  projectId: string,
): T[] {
  const key = buildKey(entityKey, projectId);
  const getSnapshot = () => (optimisticRows.get(key) as T[] | undefined) ?? (EMPTY_ROWS as T[]);

  return useSyncExternalStore<T[]>(
    (listener) => subscribe(key, listener),
    getSnapshot,
    getSnapshot,
  );
}

/**
 * Optimistic delete — sidebar count -1 즉시 반영 (cycle-26 step K).
 * delete mutation 의 onMutate 에서 호출, onSettled 에서 제거.
 * mergeOptimisticRows 가 이 set 에 포함된 id 의 row 를 list 에서 제외.
 */
export function addOptimisticDelete(
  entityKey: string,
  projectId: string,
  entityId: string,
): void {
  const key = buildKey(entityKey, projectId);
  const set = optimisticDeletes.get(key) ?? new Set<string>();
  set.add(entityId);
  optimisticDeletes.set(key, set);
  emit(key);
}

export function removeOptimisticDelete(
  entityKey: string,
  projectId: string,
  entityId: string,
): void {
  const key = buildKey(entityKey, projectId);
  const set = optimisticDeletes.get(key);
  if (!set) return;
  set.delete(entityId);
  if (set.size === 0) optimisticDeletes.delete(key);
  emit(key);
}

export function useOptimisticDeletes(entityKey: string, projectId: string): Set<string> {
  const key = buildKey(entityKey, projectId);
  const getSnapshot = () => optimisticDeletes.get(key) ?? EMPTY_DELETES;

  return useSyncExternalStore<Set<string>>(
    (listener) => subscribe(key, listener),
    getSnapshot,
    getSnapshot,
  );
}

export function mergeOptimisticRows<T extends OptimisticEntity>(
  rows: T[] | undefined,
  optimistic: T[],
  search?: string,
  pendingDeletes?: Set<string>,
): T[] | undefined {
  // pending-delete filter — useLive 가 still 보고 있는 row 를 즉시 list 에서 제외 (step K)
  let filteredRows = rows;
  if (pendingDeletes && pendingDeletes.size > 0 && rows && rows.length > 0) {
    filteredRows = rows.filter((row) => !pendingDeletes.has(row.id));
  }

  if (optimistic.length === 0) return filteredRows;

  const filteredOptimistic = search
    ? optimistic.filter((row) => {
        const haystack = `${row.name ?? ""} ${row.title ?? ""}`.toLowerCase();
        return haystack.includes(search.toLowerCase());
      })
    : optimistic;

  if (filteredOptimistic.length === 0) return filteredRows;
  if (!filteredRows || filteredRows.length === 0) return filteredOptimistic;

  const rowIds = new Set(filteredRows.map((row) => row.id));
  return [...filteredOptimistic.filter((row) => !rowIds.has(row.id)), ...filteredRows];
}
