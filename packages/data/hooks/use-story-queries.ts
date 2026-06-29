/**
 * Story Feature — Query Hooks (DataBackend path)
 *
 * 기본 경로: useQuery + DataBackend CRUD.
 * Product Builder 신규 작업은 서버 권위 remote backend 를 기준으로 한다.
 *
 * 컴포넌트는 backend 세부 구현을 모른다. 같은 `{ data, isLoading }` 형태.
 */

import { useDataBackend } from "@repo/data/provider";
import type {
  DataBackend,
  EntityBase,
  EntityCRUD,
  EntityType,
  QueryOpts,
  StoryEntityPropertyType,
} from "@repo/data/types";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

const STALE_REMOTE_LIST = 5 * 60 * 1000;
const STALE_REMOTE_DETAIL = 2 * 60 * 1000;

export type StoryLoreEntityType = "world" | "character" | "location" | "faction" | "codex";
export type StoryLoreEntityListKey = "worlds" | "characters" | "locations" | "factions" | "codex";
export type StoryLoreEntity = EntityBase;
export type StoryLoreEntitySort = NonNullable<QueryOpts["sortBy"]>;

const STORY_LORE_ENTITY_LIST_KEYS: Record<StoryLoreEntityType, StoryLoreEntityListKey> = {
  world: "worlds",
  character: "characters",
  location: "locations",
  faction: "factions",
  codex: "codex",
};

export function toStoryLoreEntityType(category: string): StoryLoreEntityType | null {
  if (category === "place") return "location";
  if (
    category === "world" ||
    category === "character" ||
    category === "location" ||
    category === "faction" ||
    category === "codex"
  ) {
    return category;
  }
  return null;
}

export function getStoryLoreEntityListKey(type: StoryLoreEntityType): StoryLoreEntityListKey {
  return STORY_LORE_ENTITY_LIST_KEYS[type];
}

export function getStoryLoreEntityCrud(
  backend: DataBackend,
  type: StoryLoreEntityType,
): EntityCRUD<StoryLoreEntity, Record<string, unknown>, Record<string, unknown>> {
  const key = getStoryLoreEntityListKey(type);
  return backend[key] as unknown as EntityCRUD<
    StoryLoreEntity,
    Record<string, unknown>,
    Record<string, unknown>
  >;
}

export function getStoryLoreEntityListQueryKey(
  type: StoryLoreEntityType,
  projectId: string,
  search?: string,
  sortBy?: StoryLoreEntitySort,
) {
  return ["story", getStoryLoreEntityListKey(type), projectId, search, sortBy] as const;
}

export function getStoryLoreEntityListQueryOptions(
  backend: DataBackend,
  type: StoryLoreEntityType,
  projectId: string,
  opts: { search?: string; sortBy?: StoryLoreEntitySort } = {},
) {
  const { search, sortBy } = opts;
  return {
    queryKey: getStoryLoreEntityListQueryKey(type, projectId, search, sortBy),
    queryFn: () => getStoryLoreEntityCrud(backend, type).list(projectId, { search, sortBy }),
    staleTime: STALE_REMOTE_LIST,
  };
}

export function useStoryLoreEntityList(
  type: StoryLoreEntityType,
  projectId: string,
  search?: string,
  sortBy?: StoryLoreEntitySort,
) {
  const backend = useDataBackend();
  return useQuery({
    ...getStoryLoreEntityListQueryOptions(backend, type, projectId, { search, sortBy }),
    enabled: !!projectId,
    placeholderData: keepPreviousData,
  });
}

export function getStoryLoreEntityById(
  backend: DataBackend,
  type: StoryLoreEntityType,
  id: string,
): Promise<StoryLoreEntity | null> {
  return getStoryLoreEntityCrud(backend, type).getById(id);
}

/* ──────────────────────────────────────────────────────────────────────
   World
   ────────────────────────────────────────────────────────────────────── */

export function useWorlds(
  projectId: string,
  search?: string,
  sortBy?: "latest" | "name" | "modified",
) {
  const backend = useDataBackend();
  const remote = useQuery({
    queryKey: ["story", "worlds", projectId, search, sortBy],
    queryFn: () => backend.worlds.list(projectId, { search, sortBy }),
    enabled: !!projectId,
    staleTime: STALE_REMOTE_LIST,
    placeholderData: keepPreviousData,
  });
  return remote;
}

export function useWorld(id: string) {
  const backend = useDataBackend();
  const remote = useQuery({
    queryKey: ["story", "world", id],
    queryFn: () => backend.worlds.getById(id),
    enabled: !!id,
    staleTime: STALE_REMOTE_DETAIL,
  });
  return remote;
}

/* ──────────────────────────────────────────────────────────────────────
   Character
   ────────────────────────────────────────────────────────────────────── */

export function useCharacters(
  projectId: string,
  search?: string,
  sortBy?: "latest" | "name" | "modified",
) {
  const backend = useDataBackend();
  const remote = useQuery({
    queryKey: ["story", "characters", projectId, search, sortBy],
    queryFn: () => backend.characters.list(projectId, { search, sortBy }),
    enabled: !!projectId,
    staleTime: STALE_REMOTE_LIST,
    placeholderData: keepPreviousData,
  });
  return remote;
}

export function useCharacter(id: string) {
  const backend = useDataBackend();
  const remote = useQuery({
    queryKey: ["story", "character", id],
    queryFn: () => backend.characters.getById(id),
    enabled: !!id,
    staleTime: STALE_REMOTE_DETAIL,
  });
  return remote;
}

/* ──────────────────────────────────────────────────────────────────────
   Location
   ────────────────────────────────────────────────────────────────────── */

export function useLocations(
  projectId: string,
  search?: string,
  sortBy?: "latest" | "name" | "modified",
) {
  const backend = useDataBackend();
  const remote = useQuery({
    queryKey: ["story", "locations", projectId, search, sortBy],
    queryFn: () => backend.locations.list(projectId, { search, sortBy }),
    enabled: !!projectId,
    staleTime: STALE_REMOTE_LIST,
    placeholderData: keepPreviousData,
  });
  return remote;
}

export function useLocation(id: string) {
  const backend = useDataBackend();
  const remote = useQuery({
    queryKey: ["story", "location", id],
    queryFn: () => backend.locations.getById(id),
    enabled: !!id,
    staleTime: STALE_REMOTE_DETAIL,
  });
  return remote;
}

/* ──────────────────────────────────────────────────────────────────────
   Faction
   ────────────────────────────────────────────────────────────────────── */

export function useFactions(
  projectId: string,
  search?: string,
  sortBy?: "latest" | "name" | "modified",
) {
  const backend = useDataBackend();
  const remote = useQuery({
    queryKey: ["story", "factions", projectId, search, sortBy],
    queryFn: () => backend.factions.list(projectId, { search, sortBy }),
    enabled: !!projectId,
    staleTime: STALE_REMOTE_LIST,
    placeholderData: keepPreviousData,
  });
  return remote;
}

export function useFaction(id: string) {
  const backend = useDataBackend();
  const remote = useQuery({
    queryKey: ["story", "faction", id],
    queryFn: () => backend.factions.getById(id),
    enabled: !!id,
    staleTime: STALE_REMOTE_DETAIL,
  });
  return remote;
}

/* ──────────────────────────────────────────────────────────────────────
   Codex
   ────────────────────────────────────────────────────────────────────── */

export function useCodexEntries(
  projectId: string,
  search?: string,
  sortBy?: "latest" | "name" | "modified",
) {
  const backend = useDataBackend();
  const remote = useQuery({
    queryKey: ["story", "codex", projectId, search, sortBy],
    queryFn: () => backend.codex.list(projectId, { search, sortBy }),
    enabled: !!projectId,
    staleTime: STALE_REMOTE_LIST,
    placeholderData: keepPreviousData,
  });
  return remote;
}

export function useCodexEntry(id: string) {
  const backend = useDataBackend();
  const remote = useQuery({
    queryKey: ["story", "codexEntry", id],
    queryFn: () => backend.codex.getById(id),
    enabled: !!id,
    staleTime: STALE_REMOTE_DETAIL,
  });
  return remote;
}

/* ──────────────────────────────────────────────────────────────────────
   Draft
   ────────────────────────────────────────────────────────────────────── */

export function useDrafts(
  projectId: string,
  search?: string,
  sortBy?: "latest" | "name" | "modified",
) {
  const backend = useDataBackend();
  const remote = useQuery({
    queryKey: ["story", "drafts", projectId, search, sortBy],
    queryFn: () => backend.drafts.list(projectId, { search, sortBy }),
    enabled: !!projectId,
    staleTime: STALE_REMOTE_LIST,
    placeholderData: keepPreviousData,
  });
  return remote;
}

export function useDraft(id: string) {
  const backend = useDataBackend();
  const remote = useQuery({
    queryKey: ["story", "draft", id],
    queryFn: () => backend.drafts.getById(id),
    enabled: !!id,
    staleTime: STALE_REMOTE_DETAIL,
  });
  return remote;
}

/* ──────────────────────────────────────────────────────────────────────
   Tag
   ────────────────────────────────────────────────────────────────────── */

export function useTags(projectId: string) {
  const backend = useDataBackend();
  const remote = useQuery({
    queryKey: ["story", "tags", projectId],
    queryFn: () => backend.tags.list(projectId),
    enabled: !!projectId,
    staleTime: STALE_REMOTE_LIST,
  });
  return remote;
}

/* ──────────────────────────────────────────────────────────────────────
   Entity Tag / Relation
   ────────────────────────────────────────────────────────────────────── */

export function useEntityTags(entityId: string, entityType: EntityType) {
  const backend = useDataBackend();
  const remote = useQuery({
    queryKey: ["story", "entityTags", entityId, entityType],
    queryFn: () => backend.entityTags.list(entityId, entityType),
    enabled: !!entityId,
    staleTime: STALE_REMOTE_DETAIL,
  });
  return remote;
}

export function useEntityProperties(entityId: string, entityType: StoryEntityPropertyType | "") {
  const backend = useDataBackend();
  const remote = useQuery({
    queryKey: ["story", "entityProperties", entityId, entityType],
    queryFn: () => backend.entityProperties.list(entityId, entityType as StoryEntityPropertyType),
    enabled: !!entityId && !!entityType,
    staleTime: STALE_REMOTE_DETAIL,
  });
  return remote;
}

export function useRelations(entityId: string, entityType: EntityType) {
  const backend = useDataBackend();
  const remote = useQuery({
    queryKey: ["story", "relations", entityId, entityType],
    queryFn: () => backend.relations.list(entityId, entityType),
    enabled: !!entityId,
    staleTime: STALE_REMOTE_DETAIL,
  });
  return remote;
}
