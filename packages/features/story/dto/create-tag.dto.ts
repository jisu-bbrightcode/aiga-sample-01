import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";

export const createTagSchema = z.object({
  id: z.string().uuid().optional(),
  name: z
    .string()
    .min(1, "태그 이름을 입력해주세요.")
    .max(100, "태그 이름은 100자를 초과할 수 없습니다."),
  color: z.string().max(20).optional(),
  projectId: z.string().uuid(),
});

export class CreateTagDto extends createZodDto(createTagSchema) {}
