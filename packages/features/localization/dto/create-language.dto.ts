import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";

export const createLanguageSchema = z.object({
  code: z
    .string()
    .min(2, "언어 코드는 2자 이상이어야 합니다.")
    .max(10, "언어 코드는 10자를 초과할 수 없습니다."),
  name: z
    .string()
    .min(1, "언어 이름을 입력해주세요.")
    .max(100, "언어 이름은 100자를 초과할 수 없습니다."),
  isSource: z.boolean().default(false),
});

export class CreateLanguageDto extends createZodDto(createLanguageSchema) {}
