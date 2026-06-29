import { type AnyRoute, createRoute } from "@tanstack/react-router";

import { AdminPaymentPage } from "./pages/admin-payment-page";
import { AuditLogPage } from "./pages/audit-log-page";
import { CouponDetailPage } from "./pages/coupon-detail-page";
import { CouponsPage } from "./pages/coupons-page";
import { InicisPage } from "./pages/inicis-page";
import { ModelPricingPage } from "./pages/model-pricing-page";
import { OrderDetailPage } from "./pages/order-detail-page";
import { OrdersPage } from "./pages/orders-page";
import { PlanManagementPage } from "./pages/plan-management-page";
import { SubscriberDetailPage } from "./pages/subscriber-detail-page";
import { SubscribersPage } from "./pages/subscribers-page";
import { TopUpManagementPage } from "./pages/top-up-management-page";

/**
 * 11 admin routes — see spec §6.1.
 */
export function createPaymentAdminRoutes(parentRoute: AnyRoute) {
  return [
    createRoute({
      getParentRoute: () => parentRoute,
      path: "/payment",
      component: AdminPaymentPage,
    }),
    createRoute({
      getParentRoute: () => parentRoute,
      path: "/payment/subscribers",
      component: SubscribersPage,
    }),
    createRoute({
      getParentRoute: () => parentRoute,
      path: "/payment/subscribers/$subscriptionId",
      component: SubscriberDetailPage,
    }),
    createRoute({
      getParentRoute: () => parentRoute,
      path: "/payment/orders",
      component: OrdersPage,
    }),
    createRoute({
      getParentRoute: () => parentRoute,
      path: "/payment/orders/$orderId",
      component: OrderDetailPage,
    }),
    createRoute({
      getParentRoute: () => parentRoute,
      path: "/payment/inicis",
      component: InicisPage,
    }),
    createRoute({
      getParentRoute: () => parentRoute,
      path: "/payment/plans",
      component: PlanManagementPage,
    }),
    createRoute({
      getParentRoute: () => parentRoute,
      path: "/payment/top-ups",
      component: TopUpManagementPage,
    }),
    createRoute({
      getParentRoute: () => parentRoute,
      path: "/payment/pricing",
      component: ModelPricingPage,
    }),
    createRoute({
      getParentRoute: () => parentRoute,
      path: "/payment/coupons",
      component: CouponsPage,
    }),
    createRoute({
      getParentRoute: () => parentRoute,
      path: "/payment/coupons/$couponId",
      component: CouponDetailPage,
    }),
    createRoute({
      getParentRoute: () => parentRoute,
      path: "/payment/audit",
      component: AuditLogPage,
    }),
  ];
}
