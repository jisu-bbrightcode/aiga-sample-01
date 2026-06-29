/**
 * Polar webhook payload zod schemas.
 *
 * Drift policy (spec §4.1): incoming payload variants are tolerated in the
 * priority order observed > SDK > docs. When Polar's actual sandbox payloads
 * disagree with the SDK or docs, the schema follows the wire — that's what
 * we'll receive in production. Required fields use plain (non-optional) zod
 * types so a missing field fails fast at parse time and surfaces as a 500
 * webhook reply (Polar then retries), making drift loud rather than silent.
 *
 * Captured fixtures live in `payment/__fixtures__/polar/*.json`. The dispatcher
 * spec exercises every fixture against its matching schema; if Polar adds /
 * removes / renames fields, recapture and re-run those tests — the diff is
 * the spec.
 *
 * IDs are typed as `z.string()` (NOT `.uuid()`) on purpose. Polar mostly emits
 * UUIDs but a handful of constructed fixtures (refund-created.json) and any
 * future non-UUID identifiers must still parse.
 */

import { z } from "zod";

const metadataSchema = z.record(z.string()).optional();

export const polarOrderPaidDataSchema = z.object({
  id: z.string(),
  status: z.string(),
  amount: z.number().int().nonnegative(),
  total_amount: z.number().int().nonnegative(),
  currency: z.string(),
  customer_id: z.string(),
  product_id: z.string(),
  subscription_id: z.string().nullable().optional(),
  checkout_id: z.string().nullable().optional(),
  billing_reason: z.string().optional(),
  metadata: metadataSchema,
});

export const polarOrderRefundedDataSchema = z.object({
  id: z.string(),
  status: z.literal("refunded").or(z.literal("partially_refunded")),
  refunded_amount: z.number().int().nonnegative(),
  subscription_id: z.string().nullable().optional(),
  metadata: metadataSchema,
});

export const polarSubscriptionDataSchema = z.object({
  id: z.string(),
  status: z.enum(["trialing", "active", "past_due", "canceled", "incomplete"]),
  current_period_start: z.string().or(z.number()).or(z.date()),
  current_period_end: z.string().or(z.number()).or(z.date()).nullable(),
  trial_end: z.string().or(z.number()).or(z.date()).nullable().optional(),
  cancel_at_period_end: z.boolean().optional(),
  customer_id: z.string(),
  product_id: z.string(),
  metadata: metadataSchema,
});

export const polarRefundDataSchema = z.object({
  id: z.string(),
  status: z.string(),
  amount: z.number().int().nonnegative(),
  /** Polar refund payloads carry top-level correlation, not in metadata */
  order_id: z.string().nullable().optional(),
  subscription_id: z.string().nullable().optional(),
  metadata: metadataSchema,
});

export const polarWebhookEnvelope = z.object({
  type: z.string(),
  data: z.record(z.unknown()),
});

export type PolarOrderPaidData = z.infer<typeof polarOrderPaidDataSchema>;
export type PolarOrderRefundedData = z.infer<typeof polarOrderRefundedDataSchema>;
export type PolarSubscriptionData = z.infer<typeof polarSubscriptionDataSchema>;
export type PolarRefundData = z.infer<typeof polarRefundDataSchema>;
