/**
 * DataBackend — Product Builder story data access contract.
 *
 * 모든 프로젝트 내부 query/mutation hook 은 이 인터페이스를 통한다.
 * Product Builder는 서버 권위 remote backend 를 기준으로 한다.
 */

// ─── Common Types ──────────────────────────────────────────

export interface QueryOpts {
  search?: string;
  sortBy?: "latest" | "name" | "modified";
  offset?: number;
  limit?: number;
}

export interface EntityBase {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  body: string | null;
  ownerId: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface World extends EntityBase {
  genre: string | null;
}

export interface Character extends EntityBase {
  age: string | null;
  occupation: string | null;
  personality: string | null;
  voice: string | null;
  roles: string[];
}

export interface Location extends EntityBase {
  region: string | null;
  climate: string | null;
}

export interface Faction extends EntityBase {
  goal: string | null;
  influence: string | null;
}

export interface CodexEntry extends EntityBase {
  category: string | null;
}

export interface Draft {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  body: string | null;
  sortOrder: number;
  ownerId: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface Tag {
  id: string;
  projectId: string;
  name: string;
  color: string | null;
}

export interface EntityTag {
  id: string;
  projectId?: string;
  entityId: string;
  entityType: string;
  tagId: string;
  tag?: Tag;
}

export type EntityType = "world" | "character" | "location" | "faction" | "codex" | "draft";
export type StoryEntityPropertyType = EntityType;

export interface StoryPropertyValue {
  key: string;
  value: string;
}

export interface StoryEntityProperty {
  id?: string;
  projectId: string;
  entityId: string;
  entityType: StoryEntityPropertyType;
  properties: StoryPropertyValue[];
}

export interface UploadEntityImageSmallInput {
  projectId: string;
  entityId: string;
  entityType: StoryEntityPropertyType;
  fileName: string;
  contentType: string;
  bytesBase64: string;
}

export interface Relation {
  id: string;
  sourceId: string;
  sourceType: string;
  targetId: string;
  targetType: string;
  targetEntityId?: string;
  targetEntityType?: string;
  targetEntityName?: string | null;
  label: string | null;
  projectId: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

// ─── CRUD Interface ────────────────────────────────────────

export interface EntityCRUD<T, CreateInput, UpdateInput = Partial<CreateInput>> {
  list(projectId: string, opts?: QueryOpts): Promise<T[]>;
  getById(id: string): Promise<T | null>;
  create(projectId: string, input: CreateInput): Promise<T>;
  update(id: string, input: UpdateInput): Promise<T>;
  delete(id: string): Promise<void>;
}

// ─── DataBackend ───────────────────────────────────────────

export type DataBackendRuntime = "remote";

export interface DataBackend {
  mode: "remote";
  runtime?: DataBackendRuntime;

  worlds: EntityCRUD<World, { name: string; description?: string; body?: string; genre?: string }>;
  characters: EntityCRUD<
    Character,
    {
      name: string;
      description?: string;
      body?: string;
      age?: string;
      occupation?: string;
      personality?: string;
      voice?: string;
      roles?: string[];
    }
  >;
  locations: EntityCRUD<
    Location,
    { name: string; description?: string; body?: string; region?: string; climate?: string }
  >;
  factions: EntityCRUD<
    Faction,
    { name: string; description?: string; body?: string; goal?: string; influence?: string }
  >;
  codex: EntityCRUD<
    CodexEntry,
    { name: string; description?: string; body?: string; category?: string }
  >;
  drafts: EntityCRUD<
    Draft,
    { title: string; description?: string; body?: string; sortOrder?: number }
  >;
  tags: {
    list(projectId: string): Promise<Tag[]>;
    create(projectId: string, input: { name: string; color?: string }): Promise<Tag>;
    delete(id: string): Promise<void>;
  };

  entityTags: {
    list(entityId: string, entityType: EntityType): Promise<EntityTag[]>;
    add(input: { entityId: string; entityType: EntityType; tagId: string }): Promise<EntityTag>;
    /**
     * Tag 생성 + entity link 한 transaction. tag-picker 의 inline create 가
     * createTag → onSuccess → addEntityTag 시리얼 chain 으로
     * 600-1300ms 였던 것을 단일 server write 로 통합 — 다른 도메인의 entityCRUD.create
     * (130-150ms) 와 동일 패턴.
     */
    addWithCreatedTag(input: {
      projectId: string;
      entityId: string;
      entityType: EntityType;
      tagName: string;
      tagColor?: string | null;
    }): Promise<{ tag: Tag; entityTag: EntityTag }>;
    remove(entityTagId: string): Promise<void>;
  };

  entityProperties: {
    list(entityId: string, entityType: StoryEntityPropertyType): Promise<StoryEntityProperty>;
    upsert(input: {
      projectId: string;
      entityId: string;
      entityType: StoryEntityPropertyType;
      key: string;
      value: string;
    }): Promise<StoryEntityProperty>;
    uploadImageSmall(input: UploadEntityImageSmallInput): Promise<{ imageSmallUrl: string }>;
  };

  relations: {
    list(entityId: string, entityType: EntityType): Promise<Relation[]>;
    create(input: {
      sourceId: string;
      sourceType: EntityType;
      targetId: string;
      targetType: EntityType;
      label?: string;
      projectId: string;
    }): Promise<Relation>;
    delete(id: string): Promise<void>;
  };
}
