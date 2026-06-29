import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";
import { storyDocString } from "./_shared";

export const createWorldSchema = z.object({
  // 클라이언트 생성 UUID — 서버 권위 write 경로에서 idempotency 보조용.
  id: z.string().uuid().optional(),
  name: z
    .string()
    .min(1, "세계관 이름을 입력해주세요.")
    .max(200, "세계관 이름은 200자를 초과할 수 없습니다."),
  description: z.string().max(5000).optional(),
  body: storyDocString.optional(),
  genre: z.string().max(100).optional(),
  projectId: z.string().uuid(),
});

export class CreateWorldDto extends createZodDto(createWorldSchema) {}
