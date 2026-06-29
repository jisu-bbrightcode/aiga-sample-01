/**
 * Payment Admin Feature (Phase 10 / spec §6.1)
 *
 * 11 admin routes wired against the Phase 8 tRPC router
 * (`payment.admin.*`, `payment.admin.{plans,topUpPackages,modelPricing,coupons,auditLog}.*`).
 */

export const PAYMENT_ADMIN_PATH = "/payment";
export const PAYMENT_ADMIN_SUBSCRIBERS_PATH = "/payment/subscribers";
export const PAYMENT_ADMIN_SUBSCRIBER_DETAIL_PATH = "/payment/subscribers/$subscriptionId";
export const PAYMENT_ADMIN_ORDERS_PATH = "/payment/orders";
export const PAYMENT_ADMIN_ORDER_DETAIL_PATH = "/payment/orders/$orderId";
export const PAYMENT_ADMIN_INICIS_PATH = "/payment/inicis";
export const PAYMENT_ADMIN_PLANS_PATH = "/payment/plans";
export const PAYMENT_ADMIN_TOPUPS_PATH = "/payment/top-ups";
export const PAYMENT_ADMIN_PRICING_PATH = "/payment/pricing";
export const PAYMENT_ADMIN_COUPONS_PATH = "/payment/coupons";
export const PAYMENT_ADMIN_COUPON_DETAIL_PATH = "/payment/coupons/$couponId";
export const PAYMENT_ADMIN_AUDIT_PATH = "/payment/audit";

export { createPaymentAdminRoutes } from "./routes";
