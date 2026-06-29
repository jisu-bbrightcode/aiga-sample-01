import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";
import { storyDocString } from "./_shared";

const characterRoles = z.array(z.string().trim().min(1).max(80)).max(20);

export const updateCharacterSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  body: storyDocString.optional(),
  age: z.string().max(50).optional(),
  occupation: z.string().max(100).optional(),
  personality: z.string().max(200).optional(),
  voice: z.string().max(200).optional(),
  roles: characterRoles.optional(),
});

export class UpdateCharacterDto extends createZodDto(updateCharacterSchema) {}
