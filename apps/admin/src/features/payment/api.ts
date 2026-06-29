import { apiClient } from "@/lib/api";

export const adminPaymentQueryKeys = {
  dashboard: () => ["admin", "payment", "dashboard"] as const,
  inicisStatus: () => ["admin", "payment", "inicis", "status"] as const,
  inicisOrders: (input: unknown) => ["admin", "payment", "inicis", "orders", input] as const,
  inicisOrder: (orderId: string | null) =>
    ["admin", "payment", "inicis", "order", orderId] as const,
  inicisEvents: (input: unknown) => ["admin", "payment", "inicis", "events", input] as const,
  inicisEvent: (eventId: string | null) =>
    ["admin", "payment", "inicis", "event", eventId] as const,
  subscribers: (input: unknown) => ["admin", "payment", "subscribers", input] as const,
  subscriber: (subscriptionId: string) =>
    ["admin", "payment", "subscriber", subscriptionId] as const,
  orders: (input: unknown) => ["admin", "payment", "orders", input] as const,
  order: (orderId: string) => ["admin", "payment", "order", orderId] as const,
  plans: () => ["admin", "payment", "plans"] as const,
  topUpPackages: () => ["admin", "payment", "top-up-packages"] as const,
  modelPricing: () => ["admin", "payment", "model-pricing"] as const,
  coupons: (input?: unknown) => ["admin", "payment", "coupons", input ?? {}] as const,
  couponRedemptions: (couponId: string, limit: number) =>
    ["admin", "payment", "coupon-redemptions", couponId, limit] as const,
  auditLog: (input: unknown) => ["admin", "payment", "audit-log", input] as const,
};

interface ApiResult<T> {
  data?: T;
  error?: unknown;
}

export interface PaymentPage<T = Record<string, unknown>> {
  rows: T[];
  nextCursor: string | null;
}

export interface PaymentDashboard {
  mrr: number;
  arr: number;
  activeSubs: number;
  trialingSubs: number;
  churn30d: number;
  mrrDelta30d: number;
  topPlans: PaymentPlan[];
  recentEvents: PaymentSubscriptionEvent[];
}

export interface SubscriberRow {
  sub: PaymentSubscription;
  plan: Pick<PaymentPlan, "name" | "priceCents"> | null;
  userEmail: string | null;
}

export interface SubscriberDetail {
  subscription: PaymentSubscription;
  events: PaymentSubscriptionEvent[];
  redemptions: PaymentCouponRedemption[];
  balance: PaymentCreditBalance;
}

export interface OrderDetail {
  order: PaymentOrder;
}

export interface PaymentPlan {
  id: string;
  slug: string;
  name: string;
  cycle: string;
  priceCents: number;
  currency: string;
  includedCreditsPerCycle: number;
  isActive: boolean;
}

export interface PaymentTopUpPackage {
  id: string;
  slug: string;
  name: string;
  credits: number;
  priceCents: number;
  currency: string;
  isActive: boolean;
}

export interface PaymentModelPricing {
  id: string;
  modelKey: string;
  displayName: string;
  inputWeightPer1kTokens: string;
  outputWeightPer1kTokens: string;
  isActive: boolean;
}

export interface PaymentCoupon {
  id: string;
  code: string;
  type: "percent" | "amount";
  percentOff: number | null;
  amountOffCents: number | null;
  duration: "once" | "repeating" | "forever";
  durationInMonths: number | null;
  appliesTo: string;
  redemptionCount: number;
  maxRedemptions: number | null;
  isActive: boolean;
}

export interface PaymentCouponRedemption {
  id: string;
  organizationId: string;
  subscriptionId: string | null;
  orderId: string | null;
  redeemedAt: string | Date;
}

export interface PaymentOrder {
  id: string;
  organizationId: string;
  userId: string;
  polarOrderId: string;
  amountCents: number;
  refundedAmountCents: number;
  currency: string;
  status: string;
  subscriptionId: string | null;
  packageId: string | null;
  invoiceUrl: string | null;
  createdAt: string | Date;
}

export interface PaymentSubscription {
  id: string;
  organizationId: string;
  userId: string;
  planId: string;
  status: string;
  polarSubscriptionId: string | null;
  currentPeriodEnd: string | Date | null;
  createdAt: string | Date;
}

export interface PaymentSubscriptionEvent {
  id: string;
  subscriptionId: string | null;
  eventType: string;
  receivedAt: string | Date;
}

export interface PaymentCreditBalance {
  balance: number;
  lastUpdatedAt?: string | Date | null;
  source?: string | null;
}

export interface PaymentAuditLogRow {
  id: string | number | bigint;
  createdAt: string | Date;
  actorUserId: string;
  action: string;
  targetOrgId: string | null;
  targetSubscriptionId: string | null;
  reason: string | null;
}

export interface InicisConfigStatus {
  configured: boolean;
  mode: "test" | "production" | null;
  midPresent: boolean;
  signKeyPresent: boolean;
  iniApiKeyPresent: boolean;
  clientIpPresent: boolean;
  returnBaseUrl: string | null;
  notiUrl: string | null;
  closeUrl: string | null;
  notiAllowedIpConfigured: boolean;
  trustProxy: boolean;
  billingBlocked: boolean;
  billingBlocker:
    | string
    | {
        code: string;
        message: string;
        requiredEvidence: readonly string[];
      };
}

export interface InicisOrder {
  id: string;
  orderId: string;
  userId: string | null;
  amount: number;
  currency: string;
  payMethod: string;
  goodsName: string;
  buyerNameMasked: string | null;
  buyerEmailMasked: string | null;
  tid: string | null;
  authTid: string | null;
  status: string;
  providerResultCode: string | null;
  providerResultMessage: string | null;
  approvedAt: string | Date | null;
  paidAt: string | Date | null;
  canceledAt: string | Date | null;
  refundedAmount: number;
  rawMasked: Record<string, unknown> | null;
  normalized: Record<string, unknown> | null;
  createdAt: string | Date;
}

export interface InicisEvent {
  id: string;
  eventType: string;
  status: string;
  orderId: string | null;
  tid: string | null;
  idempotencyKey: string;
  sourceIp: string | null;
  providerResultCode: string | null;
  providerResultMessage: string | null;
  rawMasked: Record<string, unknown>;
  normalized: Record<string, unknown> | null;
  errorCode: string | null;
  replayedFromEventId: string | null;
  processedAt: string | Date | null;
  createdAt: string | Date;
}

export interface InicisEntitlementStatus {
  status: "blocked" | "not_applicable" | "pending";
  code: string;
  message: string;
}

export interface InicisOrderDetail {
  order: InicisOrder;
  events: InicisEvent[];
  entitlementStatus: InicisEntitlementStatus;
}

export function unwrapPaymentResult<T>(result: ApiResult<T>): T {
  if (result.error) throw result.error;
  return result.data as T;
}

const inicisApiClient = apiClient as unknown as {
  GET: <T>(path: string, init?: unknown) => Promise<ApiResult<T>>;
  POST: <T>(path: string, init?: unknown) => Promise<ApiResult<T>>;
};

export const adminPaymentApi = {
  inicisStatus: async () =>
    unwrapPaymentResult<InicisConfigStatus>(
      await inicisApiClient.GET("/api/admin/payment/inicis/status"),
    ),
  inicisOrders: async (query: Record<string, unknown>) =>
    unwrapPaymentResult<PaymentPage<InicisOrder>>(
      await inicisApiClient.GET("/api/admin/payment/inicis/orders", { params: { query } }),
    ),
  inicisOrder: async (orderId: string) =>
    unwrapPaymentResult<InicisOrderDetail>(
      await inicisApiClient.GET(`/api/admin/payment/inicis/orders/${orderId}`),
    ),
  inicisEvents: async (query: Record<string, unknown>) =>
    unwrapPaymentResult<PaymentPage<InicisEvent>>(
      await inicisApiClient.GET("/api/admin/payment/inicis/events", { params: { query } }),
    ),
  inicisEvent: async (eventId: string) =>
    unwrapPaymentResult<{ event: InicisEvent }>(
      await inicisApiClient.GET(`/api/admin/payment/inicis/events/${eventId}`),
    ),
  inicisCancelOrder: async (input: {
    orderId: string;
    reason: string;
    amount?: number;
    confirmPrice?: number;
  }) =>
    unwrapPaymentResult(
      await inicisApiClient.POST(`/api/admin/payment/inicis/orders/${input.orderId}/cancel`, {
        body: {
          reason: input.reason,
          amount: input.amount,
          confirmPrice: input.confirmPrice,
        },
      }),
    ),
  inicisInquiryOrder: async (orderId: string) =>
    unwrapPaymentResult(
      await inicisApiClient.POST(`/api/admin/payment/inicis/orders/${orderId}/inquiry`),
    ),
  inicisReplayEvent: async (eventId: string) =>
    unwrapPaymentResult(
      await inicisApiClient.POST(`/api/admin/payment/inicis/events/${eventId}/replay`),
    ),
  dashboard: async () =>
    unwrapPaymentResult<PaymentDashboard>(await apiClient.GET("/api/admin/payment/dashboard")),
  subscribers: async (query: Record<string, unknown>) =>
    unwrapPaymentResult<PaymentPage<SubscriberRow>>(
      await apiClient.GET("/api/admin/payment/subscribers", { params: { query } }),
    ),
  subscriber: async (subscriptionId: string) =>
    unwrapPaymentResult<SubscriberDetail>(
      await apiClient.GET("/api/admin/payment/subscribers/{subscriptionId}", {
        params: { path: { subscriptionId } },
      }),
    ),
  orders: async (query: Record<string, unknown>) =>
    unwrapPaymentResult<PaymentPage<PaymentOrder>>(
      await apiClient.GET("/api/admin/payment/orders", { params: { query } }),
    ),
  order: async (orderId: string) =>
    unwrapPaymentResult<OrderDetail>(
      await apiClient.GET("/api/admin/payment/orders/{orderId}", {
        params: { path: { orderId } },
      }),
    ),
  refundOrder: async (input: { orderId: string; amountCents?: number; reason?: string }) =>
    unwrapPaymentResult(
      await apiClient.POST("/api/admin/payment/orders/{orderId}/refund", {
        params: { path: { orderId: input.orderId } },
        body: { amountCents: input.amountCents, reason: input.reason },
      }),
    ),
  grantCredits: async (input: Record<string, unknown>) =>
    unwrapPaymentResult(await apiClient.POST("/api/admin/payment/credits/grant", { body: input })),
  revokeCredits: async (input: Record<string, unknown>) =>
    unwrapPaymentResult(await apiClient.POST("/api/admin/payment/credits/revoke", { body: input })),
  cancelSubscriptionNow: async (input: { subscriptionId: string; reason?: string }) =>
    unwrapPaymentResult(
      await apiClient.POST("/api/admin/payment/subscribers/{subscriptionId}/cancel-now", {
        params: { path: { subscriptionId: input.subscriptionId } },
        body: { reason: input.reason },
      }),
    ),
  releaseSoftSuspend: async (input: { subscriptionId: string; reason?: string }) =>
    unwrapPaymentResult(
      await apiClient.POST("/api/admin/payment/subscribers/{subscriptionId}/release-soft-suspend", {
        params: { path: { subscriptionId: input.subscriptionId } },
        body: { reason: input.reason },
      }),
    ),
  extendTrialEnd: async (input: { subscriptionId: string; newTrialEnd: unknown; reason: string }) =>
    unwrapPaymentResult(
      await apiClient.POST("/api/admin/payment/subscribers/{subscriptionId}/extend-trial", {
        params: { path: { subscriptionId: input.subscriptionId } },
        body: { newTrialEnd: input.newTrialEnd, reason: input.reason },
      }),
    ),
  compSubscription: async (input: Record<string, unknown>) =>
    unwrapPaymentResult(
      await apiClient.POST("/api/admin/payment/subscriptions/comp", { body: input }),
    ),
  plans: async () =>
    unwrapPaymentResult<PaymentPlan[]>(await apiClient.GET("/api/admin/payment/plans")),
  createPlan: async (input: Record<string, unknown>) =>
    unwrapPaymentResult(await apiClient.POST("/api/admin/payment/plans", { body: input })),
  updatePlan: async (
    input: { id: string; patch?: Record<string, unknown> } & Record<string, unknown>,
  ) =>
    unwrapPaymentResult(
      await apiClient.PATCH("/api/admin/payment/plans/{id}", {
        params: { path: { id: input.id } },
        body: input.patch ?? withoutId(input),
      }),
    ),
  archivePlan: async (input: { id: string }) =>
    unwrapPaymentResult(
      await apiClient.DELETE("/api/admin/payment/plans/{id}", {
        params: { path: { id: input.id } },
      }),
    ),
  topUpPackages: async () =>
    unwrapPaymentResult<PaymentTopUpPackage[]>(
      await apiClient.GET("/api/admin/payment/top-up-packages"),
    ),
  createTopUpPackage: async (input: Record<string, unknown>) =>
    unwrapPaymentResult(
      await apiClient.POST("/api/admin/payment/top-up-packages", { body: input }),
    ),
  updateTopUpPackage: async (
    input: { id: string; patch?: Record<string, unknown> } & Record<string, unknown>,
  ) =>
    unwrapPaymentResult(
      await apiClient.PATCH("/api/admin/payment/top-up-packages/{id}", {
        params: { path: { id: input.id } },
        body: input.patch ?? withoutId(input),
      }),
    ),
  archiveTopUpPackage: async (input: { id: string }) =>
    unwrapPaymentResult(
      await apiClient.DELETE("/api/admin/payment/top-up-packages/{id}", {
        params: { path: { id: input.id } },
      }),
    ),
  modelPricing: async () =>
    unwrapPaymentResult<PaymentModelPricing[]>(
      await apiClient.GET("/api/admin/payment/model-pricing"),
    ),
  upsertModelPricing: async (input: Record<string, unknown>) =>
    unwrapPaymentResult(await apiClient.PUT("/api/admin/payment/model-pricing", { body: input })),
  archiveModelPricing: async (input: { id: string }) =>
    unwrapPaymentResult(
      await apiClient.DELETE("/api/admin/payment/model-pricing/{id}", {
        params: { path: { id: input.id } },
      }),
    ),
  coupons: async (query: Record<string, unknown> = {}) =>
    unwrapPaymentResult<PaymentCoupon[]>(
      await apiClient.GET("/api/admin/payment/coupons", { params: { query } }),
    ),
  createCoupon: async (input: Record<string, unknown>) =>
    unwrapPaymentResult(await apiClient.POST("/api/admin/payment/coupons", { body: input })),
  updateCoupon: async (
    input: { id: string; patch?: Record<string, unknown> } & Record<string, unknown>,
  ) =>
    unwrapPaymentResult(
      await apiClient.PATCH("/api/admin/payment/coupons/{id}", {
        params: { path: { id: input.id } },
        body: input.patch ?? withoutId(input),
      }),
    ),
  archiveCoupon: async (input: { id: string }) =>
    unwrapPaymentResult(
      await apiClient.DELETE("/api/admin/payment/coupons/{id}", {
        params: { path: { id: input.id } },
      }),
    ),
  couponRedemptions: async (couponId: string, limit: number) =>
    unwrapPaymentResult<PaymentPage<PaymentCouponRedemption>>(
      await apiClient.GET("/api/admin/payment/coupons/{couponId}/redemptions", {
        params: { path: { couponId }, query: { limit } },
      }),
    ),
  auditLog: async (query: Record<string, unknown>) =>
    unwrapPaymentResult<PaymentPage<PaymentAuditLogRow>>(
      await apiClient.GET("/api/admin/payment/audit-log", { params: { query } }),
    ),
};

function withoutId(input: Record<string, unknown> & { id: string }) {
  const { id: _id, ...rest } = input;
  return rest;
}
