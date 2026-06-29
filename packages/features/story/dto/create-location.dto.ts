import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";
import { storyDocString } from "./_shared";

export const createLocationSchema = z.object({
  id: z.string().uuid().optional(),
  name: z
    .string()
    .min(1, "장소 이름을 입력해주세요.")
    .max(200, "장소 이름은 200자를 초과할 수 없습니다."),
  description: z.string().max(5000).optional(),
  body: storyDocString.optional(),
  region: z.string().max(100).optional(),
  climate: z.string().max(100).optional(),
  projectId: z.string().uuid(),
});

export class CreateLocationDto extends createZodDto(createLocationSchema) {}
