import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";
import { storyEntityTypeSchema } from "./create-relation.dto";

export const addEntityTagSchema = z.object({
  /** Client-generated UUID for server-write idempotency. */
  id: z.string().uuid().optional(),
  entityId: z.string().uuid(),
  entityType: storyEntityTypeSchema,
  tagId: z.string().uuid(),
});

export class AddEntityTagDto extends createZodDto(addEntityTagSchema) {}
