import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";

export const createTranslationSchema = z.object({
  languageId: z.string().uuid(),
  entityId: z.string().uuid(),
  entityType: z.string().min(1).max(50),
  field: z.string().min(1).max(50),
  sourceText: z.string().optional(),
  translatedText: z.string().optional(),
  status: z.enum(["pending", "translated", "reviewed", "approved"]).default("pending"),
});

export class CreateTranslationDto extends createZodDto(createTranslationSchema) {}
