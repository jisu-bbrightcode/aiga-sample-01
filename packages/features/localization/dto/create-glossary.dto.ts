import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";

const glossaryTranslationSchema = z.object({
  languageCode: z.string().min(2).max(10),
  translation: z.string().min(1),
});

export const createGlossarySchema = z.object({
  term: z.string().min(1, "용어를 입력해주세요.").max(200, "용어는 200자를 초과할 수 없습니다."),
  definition: z.string().optional(),
  translations: z.array(glossaryTranslationSchema).default([]),
});

export class CreateGlossaryDto extends createZodDto(createGlossarySchema) {}
