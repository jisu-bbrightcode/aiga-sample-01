import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";
import { storyDocString } from "./_shared";

export const createFactionSchema = z.object({
  id: z.string().uuid().optional(),
  name: z
    .string()
    .min(1, "세력 이름을 입력해주세요.")
    .max(200, "세력 이름은 200자를 초과할 수 없습니다."),
  description: z.string().max(5000).optional(),
  body: storyDocString.optional(),
  goal: z.string().max(5000).optional(),
  influence: z.string().max(200).optional(),
  projectId: z.string().uuid(),
});

export class CreateFactionDto extends createZodDto(createFactionSchema) {}
