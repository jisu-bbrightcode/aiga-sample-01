import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";
import { storyDocString } from "./_shared";

export const updateCodexSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  body: storyDocString.optional(),
  category: z.string().max(100).optional(),
});

export class UpdateCodexDto extends createZodDto(updateCodexSchema) {}
