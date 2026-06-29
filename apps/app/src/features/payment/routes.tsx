/**
 * Payment Feature — TanStack Router route factories.
 *
 * Public routes mount under `rootRoute` (no auth guard) so Polar can redirect
 * back to /payment/{success,cancel} even mid-session, and /pricing remains
 * crawlable. Auth routes mount under `appLayoutRoute` for the standard
 * AuthGuard + sidebar shell.
 */
import { type AnyRoute, createRoute } from "@tanstack/react-router";

import { BillingOverviewPage } from "./pages/billing-overview-page";
import { CheckoutCancelPage } from "./pages/checkout-cancel-page";
import { CheckoutSuccessPage } from "./pages/checkout-success-page";
import { InvoicesPage } from "./pages/invoices-page";
import { MySubscriptionPage } from "./pages/my-subscription-page";
import { PaymentResultPage } from "./pages/payment-result-page";
import { PricingPage } from "./pages/pricing-page";
import { TopUpPage } from "./pages/top-up-page";
import { UpgradePage } from "./pages/upgrade-page";
import { UsagePage } from "./pages/usage-page";

export function createPaymentPublicRoutes(rootRoute: AnyRoute) {
  return [
    createRoute({
      getParentRoute: () => rootRoute,
      path: "/pricing",
      component: PricingPage,
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: "/payment/success",
      component: CheckoutSuccessPage,
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: "/payment/cancel",
      component: CheckoutCancelPage,
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: "/payment/result",
      component: PaymentResultPage,
    }),
  ];
}

export function createPaymentAuthRoutes(appLayoutRoute: AnyRoute) {
  return [
    createRoute({
      getParentRoute: () => appLayoutRoute,
      path: "/billing",
      component: BillingOverviewPage,
    }),
    createRoute({
      getParentRoute: () => appLayoutRoute,
      path: "/billing/subscription",
      component: MySubscriptionPage,
    }),
    createRoute({
      getParentRoute: () => appLayoutRoute,
      path: "/billing/upgrade",
      component: UpgradePage,
    }),
    createRoute({
      getParentRoute: () => appLayoutRoute,
      path: "/billing/top-up",
      component: TopUpPage,
    }),
    createRoute({
      getParentRoute: () => appLayoutRoute,
      path: "/billing/invoices",
      component: InvoicesPage,
    }),
    createRoute({
      getParentRoute: () => appLayoutRoute,
      path: "/billing/usage",
      component: UsagePage,
    }),
  ];
}
