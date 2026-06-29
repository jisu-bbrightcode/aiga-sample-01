import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";
import { storyDocString } from "./_shared";

const characterRoles = z.array(z.string().trim().min(1).max(80)).max(20);

export const createCharacterSchema = z.object({
  id: z.string().uuid().optional(),
  name: z
    .string()
    .min(1, "캐릭터 이름을 입력해주세요.")
    .max(200, "캐릭터 이름은 200자를 초과할 수 없습니다."),
  description: z.string().max(5000).optional(),
  body: storyDocString.optional(),
  age: z.string().max(50).optional(),
  occupation: z.string().max(100).optional(),
  personality: z.string().max(200).optional(),
  voice: z.string().max(200).optional(),
  roles: characterRoles.optional(),
  projectId: z.string().uuid(),
});

export class CreateCharacterDto extends createZodDto(createCharacterSchema) {}
