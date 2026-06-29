import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";
import { storyDocString } from "./_shared";

export const updateWorldSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  body: storyDocString.optional(),
  genre: z.string().max(100).optional(),
});

export class UpdateWorldDto extends createZodDto(updateWorldSchema) {}
