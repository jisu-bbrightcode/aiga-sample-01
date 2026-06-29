import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";

/**
 * Wire shape for an email log row.
 * All timestamp columns are Date objects in Drizzle but Fastify JSON-serializes
 * them to ISO strings, so z.string() matches the actual wire format.
 */
export const emailLogResponseSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  // recipient
  recipientEmail: z.string(),
  recipientName: z.string().nullable(),
  recipientId: z.string().nullable(),
  // email info
  templateType: z.enum([
    "welcome",
    "email-verification",
    "password-reset",
    "password-changed",
    "notification",
  ]),
  subject: z.string(),
  // status
  status: z.enum(["pending", "sending", "sent", "delivered", "failed", "bounced", "opened"]),
  providerMessageId: z.string().nullable(),
  failureReason: z.string().nullable(),
  retryCount: z.number(),
  // timestamps (nullable)
  sentAt: z.string().nullable(),
  deliveredAt: z.string().nullable(),
  openedAt: z.string().nullable(),
  // metadata
  metadata: z.record(z.string(), z.any()).nullable(),
});

export class EmailLogResponseDto extends createZodDto(emailLogResponseSchema) {}

/** Shape returned by the resend endpoint: { success, log } */
export const resendEmailResponseSchema = z.object({
  success: z.boolean(),
  log: emailLogResponseSchema,
});

export class ResendEmailResponseDto extends createZodDto(resendEmailResponseSchema) {}

/** Shape returned by the previewTemplate endpoint: { html } */
export const previewTemplateResponseSchema = z.object({
  html: z.string(),
});

export class PreviewTemplateResponseDto extends createZodDto(previewTemplateResponseSchema) {}
