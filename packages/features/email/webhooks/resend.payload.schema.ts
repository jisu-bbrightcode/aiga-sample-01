import { z } from "zod";

/**
 * Resend webhook event payloads.
 * https://resend.com/docs/dashboard/webhooks/event-types
 *
 * The schema is intentionally permissive (`.passthrough()`) — Resend adds
 * fields over time and we only depend on `type` + `data.email_id` plus the
 * optional bounce detail. Unknown event types are accepted and ignored
 * downstream rather than rejected at the boundary.
 */

export const RESEND_WEBHOOK_EVENT_TYPES = [
  "email.sent",
  "email.delivered",
  "email.delivery_delayed",
  "email.bounced",
  "email.complained",
  "email.opened",
  "email.clicked",
  "email.failed",
] as const;

export type ResendWebhookEventType = (typeof RESEND_WEBHOOK_EVENT_TYPES)[number];

const resendBounceSchema = z
  .object({
    type: z.string().optional(),
    subType: z.string().optional(),
    message: z.string().optional(),
  })
  .passthrough();

const resendWebhookDataSchema = z
  .object({
    email_id: z.string().optional(),
    to: z.union([z.string(), z.array(z.string())]).optional(),
    subject: z.string().optional(),
    bounce: resendBounceSchema.optional(),
  })
  .passthrough();

export const resendWebhookPayloadSchema = z.object({
  type: z.string(),
  created_at: z.string().optional(),
  data: resendWebhookDataSchema,
});

export type ResendWebhookPayload = z.infer<typeof resendWebhookPayloadSchema>;

export function parseResendWebhookPayload(rawBody: string | Buffer): ResendWebhookPayload {
  const text = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : rawBody;
  return resendWebhookPayloadSchema.parse(JSON.parse(text));
}
