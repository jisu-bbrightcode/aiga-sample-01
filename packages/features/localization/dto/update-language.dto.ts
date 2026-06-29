import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";

export const updateLanguageSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  isSource: z.boolean().optional(),
});

export class UpdateLanguageDto extends createZodDto(updateLanguageSchema) {}
