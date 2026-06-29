import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";
import { storyDocString } from "./_shared";

export const createDraftSchema = z.object({
  id: z.string().uuid().optional(),
  title: z
    .string()
    .min(1, "초안 제목을 입력해주세요.")
    .max(300, "초안 제목은 300자를 초과할 수 없습니다."),
  description: z.string().max(5000).optional(),
  body: storyDocString.optional(),
  sortOrder: z.number().int().optional(),
  projectId: z.string().uuid(),
});

export class CreateDraftDto extends createZodDto(createDraftSchema) {}
