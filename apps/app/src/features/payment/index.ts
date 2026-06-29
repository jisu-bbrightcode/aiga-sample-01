/**
 * Payment Feature (User App, Phase 11 / spec §6.2)
 *
 * 9 routes: 1 public (/pricing) + 2 redirect (/payment/success, /payment/cancel)
 * + 6 auth (/billing*).
 *
 * tRPC procedures used: `payment.public.{listPlans, listTopUpPackages, previewCoupon}`
 * + `payment.{getMySubscription, getMyCreditBalance, getMyCreditHistory, getMyUsageStats,
 *   listMyInvoices, createSubscriptionCheckout, createTopUpCheckout, changePlan,
 *   cancelSubscription, reactivateSubscription}`.
 */

export const PAYMENT_PRICING_PATH = "/pricing";
export const PAYMENT_SUCCESS_PATH = "/payment/success";
export const PAYMENT_CANCEL_PATH = "/payment/cancel";
export const PAYMENT_RESULT_PATH = "/payment/result";

export const BILLING_PATH = "/billing";
export const BILLING_SUBSCRIPTION_PATH = "/billing/subscription";
export const BILLING_UPGRADE_PATH = "/billing/upgrade";
export const BILLING_TOPUP_PATH = "/billing/top-up";
export const BILLING_INVOICES_PATH = "/billing/invoices";
export const BILLING_USAGE_PATH = "/billing/usage";

export { createPaymentAuthRoutes, createPaymentPublicRoutes } from "./routes";
