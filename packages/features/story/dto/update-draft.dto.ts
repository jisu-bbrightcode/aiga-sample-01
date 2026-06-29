import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";
import { storyDocString } from "./_shared";

export const updateDraftSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(5000).optional(),
  body: storyDocString.optional(),
  sortOrder: z.number().int().optional(),
});

export class UpdateDraftDto extends createZodDto(updateDraftSchema) {}
