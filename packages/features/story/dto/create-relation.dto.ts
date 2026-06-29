import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";

export const storyPropertyEntityTypeSchema = z.enum([
  "world",
  "character",
  "location",
  "faction",
  "codex",
  "draft",
]);

export const storyEntityTypeSchema = z.enum([
  "world",
  "character",
  "location",
  "faction",
  "codex",
  "draft",
]);

// NOTE: sourceType and targetType use distinct z.enum objects (same values but
// separate instances) to avoid @nestjs/swagger's circular-dep detection which
// triggers when the same enum schema object appears in two properties of a DTO.
const _relationSourceTypeSchema = z.enum([
  "world",
  "character",
  "location",
  "faction",
  "codex",
  "draft",
]);
const _relationTargetTypeSchema = z.enum([
  "world",
  "character",
  "location",
  "faction",
  "codex",
  "draft",
]);

export const createRelationSchema = z.object({
  id: z.string().uuid().optional(),
  sourceId: z.string().uuid(),
  sourceType: _relationSourceTypeSchema,
  targetId: z.string().uuid(),
  targetType: _relationTargetTypeSchema,
  label: z.string().max(100).optional(),
  projectId: z.string().uuid(),
});

export class CreateRelationDto extends createZodDto(createRelationSchema) {}
