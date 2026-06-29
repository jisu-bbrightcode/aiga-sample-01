/**
 * Remote Backend - REST API adapter.
 *
 * 웹 브라우저에서 사용하는 DataBackend 구현. Host 앱이 인증 헤더가 설정된
 * OpenAPI client 를 주입하고, 이 모듈은 DataBackend 계약에 맞게 REST
 * 호출 결과를 변환한다.
 */

import type { ProductBuilderApi } from "@repo/api-client";
import type {
  DataBackend,
  EntityTag,
  EntityType,
  Relation,
  StoryEntityProperty,
  StoryEntityPropertyType,
  Tag,
} from "@repo/data/types";

type ApiClient = ProductBuilderApi["client"];
interface ApiResult<T> {
  data?: T;
  error?: unknown;
  response?: Response;
}

export interface RemoteBackendDeps {
  /** apps/app 의 createProductBuilderApi(...).client 결과. */
  api: ApiClient;
}

async function requireApiData<T>(request: Promise<ApiResult<unknown>>): Promise<T> {
  const { data, error } = await request;
  if (error) throw error;
  if (data === undefined) throw new Error("REST response did not include data");
  return data as T;
}

async function requireNullableApiData<T>(request: Promise<ApiResult<unknown>>): Promise<T | null> {
  const { data, error, response } = await request;
  if (error) {
    if (response?.status === 404) return null;
    throw error;
  }
  return (data as T | undefined) ?? null;
}

async function requireApiSuccess(request: Promise<ApiResult<unknown>>): Promise<void> {
  const { error } = await request;
  if (error) throw error;
}

function asStoryEntityPropertyType(entityType: EntityType): StoryEntityPropertyType {
  return entityType as StoryEntityPropertyType;
}

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: Single adapter table keeps remote DataBackend wiring easy to audit.
export function createRemoteBackend(deps: RemoteBackendDeps): DataBackend {
  const api = deps.api;

  return {
    mode: "remote",
    runtime: "remote",

    worlds: {
      list: (projectId, opts) =>
        requireApiData(
          api.GET("/api/story/worlds", {
            params: { query: { projectId, search: opts?.search, sortBy: opts?.sortBy } },
          }),
        ),
      getById: (id) =>
        requireNullableApiData(api.GET("/api/story/worlds/{id}", { params: { path: { id } } })),
      create: (projectId, input) =>
        requireApiData(api.POST("/api/story/worlds", { body: { ...input, projectId } })),
      update: (id, input) =>
        requireApiData(
          api.PUT("/api/story/worlds/{id}", { params: { path: { id } }, body: input }),
        ),
      delete: (id) =>
        requireApiSuccess(api.DELETE("/api/story/worlds/{id}", { params: { path: { id } } })),
    },

    characters: {
      list: (projectId, opts) =>
        requireApiData(
          api.GET("/api/story/characters", {
            params: { query: { projectId, search: opts?.search, sortBy: opts?.sortBy } },
          }),
        ),
      getById: (id) =>
        requireNullableApiData(api.GET("/api/story/characters/{id}", { params: { path: { id } } })),
      create: (projectId, input) =>
        requireApiData(api.POST("/api/story/characters", { body: { ...input, projectId } })),
      update: (id, input) =>
        requireApiData(
          api.PUT("/api/story/characters/{id}", { params: { path: { id } }, body: input }),
        ),
      delete: (id) =>
        requireApiSuccess(api.DELETE("/api/story/characters/{id}", { params: { path: { id } } })),
    },

    locations: {
      list: (projectId, opts) =>
        requireApiData(
          api.GET("/api/story/locations", {
            params: { query: { projectId, search: opts?.search, sortBy: opts?.sortBy } },
          }),
        ),
      getById: (id) =>
        requireNullableApiData(api.GET("/api/story/locations/{id}", { params: { path: { id } } })),
      create: (projectId, input) =>
        requireApiData(api.POST("/api/story/locations", { body: { ...input, projectId } })),
      update: (id, input) =>
        requireApiData(
          api.PUT("/api/story/locations/{id}", { params: { path: { id } }, body: input }),
        ),
      delete: (id) =>
        requireApiSuccess(api.DELETE("/api/story/locations/{id}", { params: { path: { id } } })),
    },

    factions: {
      list: (projectId, opts) =>
        requireApiData(
          api.GET("/api/story/factions", {
            params: { query: { projectId, search: opts?.search, sortBy: opts?.sortBy } },
          }),
        ),
      getById: (id) =>
        requireNullableApiData(api.GET("/api/story/factions/{id}", { params: { path: { id } } })),
      create: (projectId, input) =>
        requireApiData(api.POST("/api/story/factions", { body: { ...input, projectId } })),
      update: (id, input) =>
        requireApiData(
          api.PUT("/api/story/factions/{id}", { params: { path: { id } }, body: input }),
        ),
      delete: (id) =>
        requireApiSuccess(api.DELETE("/api/story/factions/{id}", { params: { path: { id } } })),
    },

    codex: {
      list: (projectId, opts) =>
        requireApiData(
          api.GET("/api/story/codex", {
            params: { query: { projectId, search: opts?.search, sortBy: opts?.sortBy } },
          }),
        ),
      getById: (id) =>
        requireNullableApiData(api.GET("/api/story/codex/{id}", { params: { path: { id } } })),
      create: (projectId, input) =>
        requireApiData(api.POST("/api/story/codex", { body: { ...input, projectId } })),
      update: (id, input) =>
        requireApiData(api.PUT("/api/story/codex/{id}", { params: { path: { id } }, body: input })),
      delete: (id) =>
        requireApiSuccess(api.DELETE("/api/story/codex/{id}", { params: { path: { id } } })),
    },

    drafts: {
      list: (projectId, opts) =>
        requireApiData(
          api.GET("/api/story/drafts", {
            params: { query: { projectId, search: opts?.search, sortBy: opts?.sortBy } },
          }),
        ),
      getById: (id) =>
        requireNullableApiData(api.GET("/api/story/drafts/{id}", { params: { path: { id } } })),
      create: (projectId, input) =>
        requireApiData(api.POST("/api/story/drafts", { body: { ...input, projectId } })),
      update: (id, input) =>
        requireApiData(
          api.PUT("/api/story/drafts/{id}", { params: { path: { id } }, body: input }),
        ),
      delete: (id) =>
        requireApiSuccess(api.DELETE("/api/story/drafts/{id}", { params: { path: { id } } })),
    },

    tags: {
      list: (projectId) =>
        requireApiData(api.GET("/api/story/tags", { params: { query: { projectId } } })),
      create: (projectId, input) =>
        requireApiData(api.POST("/api/story/tags", { body: { ...input, projectId } })),
      delete: (id) =>
        requireApiSuccess(api.DELETE("/api/story/tags/{id}", { params: { path: { id } } })),
    },

    entityTags: {
      list: (entityId, entityType) =>
        requireApiData(
          api.GET("/api/story/entity-tags", { params: { query: { entityId, entityType } } }),
        ),
      add: (input) => requireApiData(api.POST("/api/story/entity-tags", { body: input })),
      addWithCreatedTag: async (input) => {
        const tag = await requireApiData<Tag>(
          api.POST("/api/story/tags", {
            body: {
              name: input.tagName,
              color: input.tagColor ?? undefined,
              projectId: input.projectId,
            },
          }),
        );
        const entityTag = await requireApiData<EntityTag>(
          api.POST("/api/story/entity-tags", {
            body: {
              entityId: input.entityId,
              entityType: input.entityType,
              tagId: tag.id,
            },
          }),
        );
        return { tag, entityTag };
      },
      remove: (entityTagId) =>
        requireApiSuccess(
          api.DELETE("/api/story/entity-tags/{id}", { params: { path: { id: entityTagId } } }),
        ),
    },

    entityProperties: {
      list: (entityId, entityType) =>
        requireApiData<StoryEntityProperty>(
          api.GET("/api/story/entity-properties", {
            params: { query: { entityId, entityType } },
          }),
        ),
      upsert: (input) =>
        requireApiData<StoryEntityProperty>(
          api.PUT("/api/story/entity-properties", { body: input }),
        ),
      uploadImageSmall: (input) =>
        requireApiData(
          api.POST("/api/story/entity-properties/upload-image-small", { body: input }),
        ),
    },

    relations: {
      list: (entityId, entityType) =>
        requireApiData<Relation[]>(
          api.GET("/api/story/relations", {
            params: { query: { entityId, entityType: asStoryEntityPropertyType(entityType) } },
          }),
        ),
      create: (input) =>
        requireApiData<Relation>(api.POST("/api/story/relations", { body: input })),
      delete: (id) =>
        requireApiSuccess(api.DELETE("/api/story/relations/{id}", { params: { path: { id } } })),
    },
  };
}
