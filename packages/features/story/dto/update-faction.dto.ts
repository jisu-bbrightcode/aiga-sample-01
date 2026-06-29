import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";
import { storyDocString } from "./_shared";

export const updateFactionSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  body: storyDocString.optional(),
  goal: z.string().max(5000).optional(),
  influence: z.string().max(200).optional(),
});

export class UpdateFactionDto extends createZodDto(updateFactionSchema) {}
