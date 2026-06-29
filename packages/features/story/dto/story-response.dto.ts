import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";

/**
 * Wire shapes for story feature REST responses.
 * Timestamp columns are Date in Drizzle but Fastify JSON-serializes them to
 * ISO strings — so all date fields use z.string().
 */

// ── Common ─────────────────────────────────────────────────────────────────

export const deleteResponseSchema = z.object({ success: z.boolean() });
export class DeleteResponseDto extends createZodDto(deleteResponseSchema) {}

const storyEntityTypeEnum = [
  "world",
  "character",
  "location",
  "faction",
  "codex",
  "draft",
] as const;

const storyPropertyEntityTypeEnum = [
  "world",
  "character",
  "location",
  "faction",
  "codex",
  "draft",
] as const;

// ── World ──────────────────────────────────────────────────────────────────

export const worldResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  body: z.string().nullable(),
  genre: z.string().nullable(),
  projectId: z.string(),
  ownerId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
  isDeleted: z.boolean(),
});

export class WorldResponseDto extends createZodDto(worldResponseSchema) {}

// ── Character ──────────────────────────────────────────────────────────────

export const characterResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  body: z.string().nullable(),
  age: z.string().nullable(),
  occupation: z.string().nullable(),
  personality: z.string().nullable(),
  voice: z.string().nullable(),
  roles: z.array(z.string()),
  projectId: z.string(),
  ownerId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
  isDeleted: z.boolean(),
});

export class CharacterResponseDto extends createZodDto(characterResponseSchema) {}

// ── Location ───────────────────────────────────────────────────────────────

export const locationResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  body: z.string().nullable(),
  region: z.string().nullable(),
  climate: z.string().nullable(),
  projectId: z.string(),
  ownerId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
  isDeleted: z.boolean(),
});

export class LocationResponseDto extends createZodDto(locationResponseSchema) {}

// ── Faction ────────────────────────────────────────────────────────────────

export const factionResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  body: z.string().nullable(),
  goal: z.string().nullable(),
  influence: z.string().nullable(),
  projectId: z.string(),
  ownerId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
  isDeleted: z.boolean(),
});

export class FactionResponseDto extends createZodDto(factionResponseSchema) {}

// ── Codex ──────────────────────────────────────────────────────────────────

export const codexResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  body: z.string().nullable(),
  category: z.string().nullable(),
  projectId: z.string(),
  ownerId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
  isDeleted: z.boolean(),
});

export class CodexResponseDto extends createZodDto(codexResponseSchema) {}

// ── Draft ──────────────────────────────────────────────────────────────────

export const draftResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  body: z.string().nullable(),
  sortOrder: z.number(),
  projectId: z.string(),
  ownerId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
  isDeleted: z.boolean(),
});

export class DraftResponseDto extends createZodDto(draftResponseSchema) {}

// ── Tag ────────────────────────────────────────────────────────────────────

export const tagResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullable(),
  description: z.string().nullable(),
  projectId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
  isDeleted: z.boolean(),
});

export class TagResponseDto extends createZodDto(tagResponseSchema) {}

// ── Entity Tag ─────────────────────────────────────────────────────────────

const entityTagInlineTagSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullable(),
});

export const entityTagResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  entityId: z.string(),
  entityType: z.enum(storyEntityTypeEnum),
  tagId: z.string(),
  createdAt: z.string(),
  tag: entityTagInlineTagSchema.nullable(),
});

export class EntityTagResponseDto extends createZodDto(entityTagResponseSchema) {}

// POST /story/entity-tags returns the bare insert row — no joined `tag` field.
export const addEntityTagResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  entityId: z.string(),
  entityType: z.enum(storyEntityTypeEnum),
  tagId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
  isDeleted: z.boolean(),
});

export class AddEntityTagResponseDto extends createZodDto(addEntityTagResponseSchema) {}

// ── Entity Property ────────────────────────────────────────────────────────

const storyPropertyValueSchema = z.object({
  key: z.string(),
  value: z.string(),
});

export const entityPropertyResponseSchema = z.object({
  id: z.string().optional(),
  entityId: z.string(),
  entityType: z.enum(storyPropertyEntityTypeEnum),
  projectId: z.string(),
  properties: z.array(storyPropertyValueSchema).nullable(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  deletedAt: z.string().nullable().optional(),
  isDeleted: z.boolean().optional(),
});

export class EntityPropertyResponseDto extends createZodDto(entityPropertyResponseSchema) {}

export const uploadImageSmallResponseSchema = z.object({
  imageSmallUrl: z.string(),
});

export class UploadImageSmallResponseDto extends createZodDto(uploadImageSmallResponseSchema) {}

// ── Relation ───────────────────────────────────────────────────────────────

// NOTE: sourceType/targetType use distinct z.enum instances (same values but
// separate objects) to avoid @nestjs/swagger's circular-dep detection that
// triggers when the same enum schema object appears in two properties of a DTO.
const _responseSourceTypeSchema = z.enum([
  "world",
  "character",
  "location",
  "faction",
  "codex",
  "draft",
] as const);
const _responseTargetTypeSchema = z.enum([
  "world",
  "character",
  "location",
  "faction",
  "codex",
  "draft",
] as const);

export const relationResponseSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  sourceType: _responseSourceTypeSchema,
  targetId: z.string(),
  targetType: _responseTargetTypeSchema,
  label: z.string().nullable(),
  projectId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
  isDeleted: z.boolean(),
});

export class RelationResponseDto extends createZodDto(relationResponseSchema) {}

// RelationListResponseDto extends the base with the three fields that
// StoryRelationService.listRelations augments onto every returned row.
export const relationListResponseSchema = relationResponseSchema.extend({
  targetEntityId: z.string(),
  targetEntityType: z.string(),
  targetEntityName: z.string().nullable(),
});

export class RelationListResponseDto extends createZodDto(relationListResponseSchema) {}
