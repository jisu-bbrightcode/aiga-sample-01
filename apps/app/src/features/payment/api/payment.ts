import { $api, apiClient } from "@/lib/api";

export type CouponScope = "subscription" | "top_up";

export interface PaymentPlan {
  id: string;
  slug: string;
  name: string;
  cycle: "lifetime" | "monthly" | "yearly";
  priceCents: number;
  currency: string;
  includedCreditsPerCycle: number;
  seats: number;
  trialDays: number;
  polarProductId: string | null;
}

export interface TopUpPackage {
  id: string;
  slug: string;
  name: string;
  credits: number;
  priceCents: number;
  currency: string;
  polarProductId: string;
}

export interface Subscription {
  id: string;
  planId?: string | null;
  status: "trialing" | "active" | "past_due" | "grace" | "canceled";
  currentPeriodStart?: string | Date | null;
  currentPeriodEnd: string | Date;
  cancelAtPeriodEnd: boolean;
  graceEndsAt?: string | Date | null;
}

export interface CreditBalance {
  balance: number;
  lastUpdatedAt?: string | Date | null;
  source?: string | null;
}

export interface CreditHistory {
  rows: Record<string, unknown>[];
  nextCursor: string | null;
}

export interface UsageStats {
  byModel: Record<string, { credits: number; calls: number }>;
  totalCredits: number;
  totalCalls: number;
}

export interface InvoiceList {
  rows?: PaymentInvoice[];
  items?: PaymentInvoice[];
  nextCursor: string | null;
}

export interface PaymentInvoice {
  id: string;
  polarOrderId: string;
  amountCents: number;
  currency: string;
  status: "paid" | "refunded" | "partially_refunded" | "failed";
  invoiceUrl: string | null;
  createdAt: string | Date;
}

export interface PlanChangePreview {
  kind: "upgrade" | "downgrade" | "cycle-up" | "cycle-down";
  prorationCents: number;
  nextChargeAt: string | Date;
}

export interface ExtraUsageSettings {
  enabled: boolean;
  monthlyLimitCents: number;
  autoRechargeEnabled: boolean;
  autoRechargeThresholdCents: number;
  autoRechargePackageId: string | null;
  monthlyRechargeCapCount?: number | null;
  monthlyRechargeCapCents?: number | null;
}

export interface ExtraUsageStats {
  accumulatedCents: number;
  paidBalanceCents: number;
  cycleEnd: string | Date | null;
  currency: string;
}

export interface CouponPreviewInput {
  code: string;
  scope: CouponScope;
}

export interface CouponPreview {
  valid: boolean;
  reason?: string;
  invalidMessageKey?: string;
  type?: string;
  amountOffCents?: number;
  percentOff?: number;
}

export interface CreditHistoryInput {
  cursor?: string;
  limit?: number;
  reasonFilter?: string;
}

export interface InvoiceListInput {
  cursor?: string;
  limit?: number;
}

export interface SubscriptionCheckoutInput {
  planId: string;
  billingCycle: "monthly" | "yearly";
  couponCode?: string;
  successUrl: string;
}

export interface TopUpCheckoutInput {
  packageId: string;
  couponCode?: string;
  successUrl: string;
}

export interface ChangePlanInput {
  targetPlanId: string;
}

export interface CancelSubscriptionInput {
  mode: "at_period_end" | "with_refund";
  reason?: string;
}

export interface ExtraUsageSettingsInput {
  enabled?: boolean;
  monthlyLimitCents?: number;
  autoRechargeEnabled?: boolean;
  autoRechargeThresholdCents?: number;
  autoRechargePackageId?: string | null;
  monthlyRechargeCapCount?: number | null;
  monthlyRechargeCapCents?: number | null;
}

export interface ManualTopupInput {
  packageId: string;
  successUrl: string;
}

export const paymentKeys = {
  plans: ["get", "/api/payment/plans"] as const,
  topUpPackages: ["get", "/api/payment/top-up-packages"] as const,
  mySubscription: ["get", "/api/payment/me/subscription"] as const,
  creditBalance: ["get", "/api/payment/me/credits/balance"] as const,
  creditHistory: ["get", "/api/payment/me/credits/history"] as const,
  usageStats: ["get", "/api/payment/me/usage"] as const,
  invoices: ["get", "/api/payment/me/invoices"] as const,
  planChangePreview: ["get", "/api/payment/me/subscription/plan-change-preview"] as const,
  extraUsageSettings: ["get", "/api/payment/me/extra-usage/settings"] as const,
  extraUsageStats: ["get", "/api/payment/me/extra-usage/stats"] as const,
};

function requireData<T>(data: T | undefined): T {
  if (data === undefined) {
    throw new Error("REST response body missing");
  }
  return data;
}

export function usePlansQuery() {
  return $api.useQuery(
    "get",
    "/api/payment/plans",
    {},
    {
      select: (data) => data as unknown as PaymentPlan[],
    },
  );
}

export function useTopUpPackagesQuery() {
  return $api.useQuery(
    "get",
    "/api/payment/top-up-packages",
    {},
    {
      select: (data) => data as unknown as TopUpPackage[],
    },
  );
}

export async function previewCoupon(input: CouponPreviewInput) {
  const { data, error } = await apiClient.GET("/api/payment/coupons/preview", {
    params: { query: input },
  });
  if (error) throw error;
  return requireData(data) as unknown as CouponPreview;
}

export function useMySubscriptionQuery() {
  return $api.useQuery(
    "get",
    "/api/payment/me/subscription",
    {},
    {
      select: (data) => data as unknown as Subscription | null,
    },
  );
}

export function useCreditBalanceQuery() {
  return $api.useQuery(
    "get",
    "/api/payment/me/credits/balance",
    {},
    {
      select: (data) => data as unknown as CreditBalance,
    },
  );
}

export function useCreditHistoryQuery(input: CreditHistoryInput = {}) {
  return $api.useQuery(
    "get",
    "/api/payment/me/credits/history",
    { params: { query: input } },
    { select: (data) => data as unknown as CreditHistory },
  );
}

export function usePaymentUsageStatsQuery(rangeDays: number) {
  return $api.useQuery(
    "get",
    "/api/payment/me/usage",
    { params: { query: { rangeDays } } },
    { select: (data) => data as unknown as UsageStats },
  );
}

export function useMyInvoicesQuery(input: InvoiceListInput = {}) {
  return $api.useQuery(
    "get",
    "/api/payment/me/invoices",
    { params: { query: input } },
    { select: (data) => data as unknown as InvoiceList },
  );
}

export async function createSubscriptionCheckout(input: SubscriptionCheckoutInput) {
  const { data, error } = await apiClient.POST("/api/payment/checkouts/subscription", {
    body: input,
  });
  if (error) throw error;
  return requireData(data);
}

export async function createTopUpCheckout(input: TopUpCheckoutInput) {
  const { data, error } = await apiClient.POST("/api/payment/checkouts/top-up", {
    body: input,
  });
  if (error) throw error;
  return requireData(data);
}

export function usePlanChangePreviewQuery(targetPlanId: string | null) {
  const queryTargetPlanId = targetPlanId ?? "";
  return $api.useQuery(
    "get",
    "/api/payment/me/subscription/plan-change-preview",
    { params: { query: { targetPlanId: queryTargetPlanId } } },
    {
      enabled: !!targetPlanId,
      select: (data) => data as unknown as PlanChangePreview,
    },
  );
}

export async function changePlan(input: ChangePlanInput) {
  const { data, error } = await apiClient.POST("/api/payment/me/subscription/change-plan", {
    body: input,
  });
  if (error) throw error;
  return requireData(data);
}

export async function cancelSubscription(input: CancelSubscriptionInput) {
  const { data, error } = await apiClient.POST("/api/payment/me/subscription/cancel", {
    body: input,
  });
  if (error) throw error;
  return requireData(data);
}

export async function uncancelSubscription() {
  const { data, error } = await apiClient.POST("/api/payment/me/subscription/uncancel", {});
  if (error) throw error;
  return requireData(data);
}

export async function reactivateSubscription() {
  const { data, error } = await apiClient.POST("/api/payment/me/subscription/reactivate", {});
  if (error) throw error;
  return requireData(data);
}

export function useExtraUsageSettingsQuery() {
  return $api.useQuery(
    "get",
    "/api/payment/me/extra-usage/settings",
    {},
    {
      select: (data) => data as unknown as ExtraUsageSettings,
    },
  );
}

export function useExtraUsageStatsQuery(options: { refetchInterval?: number } = {}) {
  return $api.useQuery(
    "get",
    "/api/payment/me/extra-usage/stats",
    {},
    {
      select: (data) => data as unknown as ExtraUsageStats,
      ...options,
    },
  );
}

export async function updateExtraUsageSettings(input: ExtraUsageSettingsInput) {
  const { data, error } = await apiClient.PUT("/api/payment/me/extra-usage/settings", {
    body: input,
  });
  if (error) throw error;
  return requireData(data);
}

export async function triggerManualTopup(input: ManualTopupInput) {
  const { data, error } = await apiClient.POST("/api/payment/me/extra-usage/manual-topup", {
    body: input,
  });
  if (error) throw error;
  return requireData(data);
}
