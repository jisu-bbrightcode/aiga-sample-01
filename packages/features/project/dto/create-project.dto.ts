import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";

export const createProjectSchema = z.object({
  name: z
    .string()
    .min(1, "프로젝트 이름을 입력해주세요.")
    .max(200, "프로젝트 이름은 200자를 초과할 수 없습니다."),
  description: z.string().max(2000).optional(),
  genre: z.string().max(100).optional(),
  template: z.string().max(100).optional(),
  aiMode: z.enum(["ai_powered", "ai_safety"]).default("ai_safety"),
});

export class CreateProjectDto extends createZodDto(createProjectSchema) {}
