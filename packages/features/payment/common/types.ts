/**
 * Polar adapter request/response shapes.
 *
 * These are the *internal* types our PolarAdapter exposes — a thin
 * subset of Polar's full API. Consumers should never import Polar
 * SDK types directly; the adapter is the boundary.
 */

export interface CheckoutRequest {
  productId: string;
  customerEmail: string;
  customerName?: string;
  /** Our better-auth user.id — Polar links the resulting order/subscription
   *  back via this externalCustomerId. NOT an organization id (multi-org
   *  members map to the same Polar customer via shared user). */
  customerExternalId: string;
  successUrl: string;
  metadata?: Record<string, string>;
  /** Apply a specific discount by Polar discount id (preferred) — codes are
   *  resolved by the customer at the hosted checkout. */
  discountId?: string;
  /** Spec §5.7: rapid-double-click idempotency. Forwarded as
   *  `Idempotency-Key` header so Polar dedupes server-side. */
  idempotencyKey?: string;
}

export interface CheckoutResponse {
  url: string;
  checkoutId: string;
}

export type PaymentProviderId = "polar" | "inicis";

export type CheckoutResult =
  | {
      kind: "redirect_url";
      provider: PaymentProviderId;
      url: string;
      providerCheckoutId: string;
    }
  | {
      kind: "form_post";
      provider: PaymentProviderId;
      endpoint: string;
      method: "POST";
      fields: Record<string, string>;
    };

export type PaymentCheckoutResult = CheckoutResult;

export interface RefundResult {
  provider: PaymentProviderId;
  status: string;
  providerResultId?: string;
  rawMasked?: Record<string, unknown>;
}

export type PaymentRefundResult = RefundResult;

export type PolarSubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete";

export interface PolarSubscription {
  id: string;
  customerId: string;
  productId: string;
  status: PolarSubscriptionStatus;
  currentPeriodStart: Date;
  /** Polar may report null for an open-ended subscription; our caller treats
   *  this as "no scheduled renewal" and is responsible for handling it. */
  currentPeriodEnd: Date | null;
  trialEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  metadata: Record<string, string>;
}

export type DiscountDuration = "once" | "forever" | "repeating";
export type DiscountType = "percentage" | "fixed";

export interface DiscountCreateInput {
  code: string;
  type: DiscountType;
  /** percentage discount, integer 1..100 — required when type='percentage' */
  percentage?: number;
  /** fixed-amount discount in cents — required when type='fixed' */
  amountCents?: number;
  duration: DiscountDuration;
  /** required when duration='repeating' */
  durationInMonths?: number;
  maxRedemptions?: number;
  expiresAt?: Date;
}

export interface DiscountCreateResponse {
  id: string;
  code: string;
}

export interface RefundResponse {
  id: string;
  status: string;
}
