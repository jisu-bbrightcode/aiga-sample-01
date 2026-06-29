import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";

/**
 * Wire shape for an onboarding_user_onboarding row.
 * Timestamps are Date in Drizzle but Fastify JSON-serializes them to ISO strings.
 */
export const onboardingResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  currentStep: z.number().int(),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export class OnboardingResponseDto extends createZodDto(onboardingResponseSchema) {}
