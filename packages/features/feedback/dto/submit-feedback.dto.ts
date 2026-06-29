import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";

export const submitFeedbackSchema = z.object({
  type: z.enum(["pain", "feature", "bug", "other"]),
  typeLabel: z.string().trim().min(1).max(80),
  message: z.string().trim().min(3).max(4000),
  rating: z.number().int().min(1).max(5),
  path: z.string().max(2048).optional(),
  url: z.string().max(2048).optional(),
  submittedAt: z.string().datetime().optional(),
});

export class SubmitFeedbackDto extends createZodDto(submitFeedbackSchema) {}

export const submitFeedbackResponseSchema = z.object({
  status: z.enum(["created", "skipped"]),
  postId: z.string().optional(),
  postUrl: z.string().nullable().optional(),
  reason: z.literal("not_configured").optional(),
});

export class SubmitFeedbackResponseDto extends createZodDto(submitFeedbackResponseSchema) {}
