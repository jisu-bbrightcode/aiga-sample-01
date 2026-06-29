import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";

export const updateTranslationSchema = z.object({
  translatedText: z.string().optional(),
  status: z.enum(["pending", "translated", "reviewed", "approved"]).optional(),
});

export class UpdateTranslationDto extends createZodDto(updateTranslationSchema) {}

export const bulkUpdateTranslationSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().uuid(),
      translatedText: z.string().optional(),
      status: z.enum(["pending", "translated", "reviewed", "approved"]).optional(),
    }),
  ),
});

export class BulkUpdateTranslationDto extends createZodDto(bulkUpdateTranslationSchema) {}
