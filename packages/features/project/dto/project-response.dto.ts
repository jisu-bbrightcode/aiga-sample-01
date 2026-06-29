import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";

/**
 * Wire shape for a project row.
 * All timestamp columns are Date objects in Drizzle but Fastify JSON-serializes
 * them to ISO strings, so z.string() matches the actual wire format.
 */
export const projectResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  genre: z.string().nullable(),
  template: z.string().nullable(),
  ownerId: z.string(),
  organizationId: z.string().nullable(),
  status: z.enum(["active", "archived", "completed"]),
  aiMode: z.enum(["ai_powered", "ai_safety"]),
  lastOpenedAt: z.string().nullable(),
  archivedAt: z.string().nullable(),
  handle: z.string().nullable(),
  visibility: z.enum(["private", "org", "public"]),
  coverImage: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
  isDeleted: z.boolean(),
});

export class ProjectResponseDto extends createZodDto(projectResponseSchema) {}

/** Shape returned by archive/delete endpoints. */
export const deleteResponseSchema = z.object({
  success: z.boolean(),
});

export class DeleteResponseDto extends createZodDto(deleteResponseSchema) {}
