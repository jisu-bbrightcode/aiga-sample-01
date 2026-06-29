import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";

export const updateStepSchema = z.object({
  currentStep: z.number().int().min(1).max(4),
});

export class UpdateStepDto extends createZodDto(updateStepSchema) {}
