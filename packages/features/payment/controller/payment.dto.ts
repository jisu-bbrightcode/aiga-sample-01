import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";
import { CREDIT_REASONS } from "../common/constants";

export const previewCouponSchema = z.object({
  code: z.string().min(1).max(120),
  scope: z.enum(["subscription", "top_up"]),
});

export const creditHistoryQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  reasonFilter: z.enum(CREDIT_REASONS).optional(),
});

export const usageStatsQuerySchema = z.object({
  rangeDays: z.coerce.number().int().min(1).max(365),
});

export const checkoutBaseSchema = z.object({
  couponCode: z.string().min(1).max(120).optional(),
  successUrl: z.string().url(),
});

export const createSubscriptionCheckoutSchema = checkoutBaseSchema.extend({
  planId: z.string().uuid(),
  billingCycle: z.enum(["monthly", "yearly"]),
});

export const createTopUpCheckoutSchema = checkoutBaseSchema.extend({
  packageId: z.string().uuid(),
});

export const changePlanSchema = z.object({
  targetPlanId: z.string().uuid(),
});

export const cancelSubscriptionSchema = z.object({
  mode: z.enum(["at_period_end", "with_refund"]),
  reason: z.string().max(500).optional(),
});

export const invoiceListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const updateExtraUsageSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  monthlyLimitCents: z.number().int().nonnegative().optional(),
  autoRechargeEnabled: z.boolean().optional(),
  autoRechargeThresholdCents: z.number().int().nonnegative().optional(),
  autoRechargePackageId: z.string().uuid().nullable().optional(),
  monthlyRechargeCapCount: z.number().int().nonnegative().nullable().optional(),
  monthlyRechargeCapCents: z.number().int().nonnegative().nullable().optional(),
});

export const manualTopupSchema = z.object({
  packageId: z.string().uuid(),
  successUrl: z.string().url(),
});

export class PreviewCouponDto extends createZodDto(previewCouponSchema) {}
export class CreateSubscriptionCheckoutDto extends createZodDto(createSubscriptionCheckoutSchema) {}
export class CreateTopUpCheckoutDto extends createZodDto(createTopUpCheckoutSchema) {}
export class ChangePlanDto extends createZodDto(changePlanSchema) {}
export class CancelSubscriptionDto extends createZodDto(cancelSubscriptionSchema) {}
export class UpdateExtraUsageSettingsDto extends createZodDto(updateExtraUsageSettingsSchema) {}
export class ManualTopupDto extends createZodDto(manualTopupSchema) {}

export type CreditHistoryQuery = z.infer<typeof creditHistoryQuerySchema>;
export type UsageStatsQuery = z.infer<typeof usageStatsQuerySchema>;
export type InvoiceListQuery = z.infer<typeof invoiceListQuerySchema>;

export const paymentObjectOpenApiSchema = {
  type: "object",
  additionalProperties: true,
};

export const nullablePaymentObjectOpenApiSchema = {
  ...paymentObjectOpenApiSchema,
  nullable: true,
};

export const paymentObjectListOpenApiSchema = {
  type: "array",
  items: paymentObjectOpenApiSchema,
};

export const checkoutResultOpenApiSchema = {
  type: "object",
  required: ["checkoutUrl", "polarSessionId"],
  properties: {
    checkoutUrl: { type: "string" },
    polarSessionId: { type: "string" },
  },
};

export const okResultOpenApiSchema = {
  type: "object",
  required: ["ok"],
  properties: {
    ok: { type: "boolean" },
  },
};
