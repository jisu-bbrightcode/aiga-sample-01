import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";

const glossaryTranslationSchema = z.object({
  languageCode: z.string().min(2).max(10),
  translation: z.string().min(1),
});

export const updateGlossarySchema = z.object({
  term: z.string().min(1).max(200).optional(),
  definition: z.string().optional(),
  translations: z.array(glossaryTranslationSchema).optional(),
});

export class UpdateGlossaryDto extends createZodDto(updateGlossarySchema) {}
