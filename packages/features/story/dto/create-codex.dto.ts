import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";
import { storyDocString } from "./_shared";

export const createCodexSchema = z.object({
  id: z.string().uuid().optional(),
  name: z
    .string()
    .min(1, "코덱스 이름을 입력해주세요.")
    .max(200, "코덱스 이름은 200자를 초과할 수 없습니다."),
  description: z.string().max(5000).optional(),
  body: storyDocString.optional(),
  category: z.string().max(100).optional(),
  projectId: z.string().uuid(),
});

export class CreateCodexDto extends createZodDto(createCodexSchema) {}
