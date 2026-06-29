import { useMutation } from "@tanstack/react-query";
import { createSubscriptionCheckout, createTopUpCheckout } from "../api/payment";

/** Create a Polar hosted-checkout session for a subscription plan. */
export function useCreateSubscriptionCheckout() {
  return useMutation({ mutationFn: createSubscriptionCheckout });
}

/** Create a Polar hosted-checkout session for a top-up package. */
export function useCreateTopUpCheckout() {
  return useMutation({ mutationFn: createTopUpCheckout });
}

/**
 * Build the absolute success URL Polar redirects to.
 *
 * Spec §3.1 D — Polar docs document only the `{CHECKOUT_ID}` placeholder
 * (https://docs.polar.sh/api-reference/checkouts/create-session, success_url
 * field). It is forwarded verbatim and Polar substitutes it server-side at
 * redirect time so the success page can render an immediate confirmation
 * while the `order.paid` webhook processes asynchronously.
 *
 * Including unrecognized placeholders (e.g. {ORDER_ID}) appears to cause
 * Polar's substitution logic to skip the entire URL, leaving placeholders
 * literal — so we only use the documented one.
 *
 * Polar /v1/checkouts has no `cancelUrl` field — abandoning the hosted
 * checkout returns the user to Polar's own cancel screen, not our app.
 */
export function buildCheckoutReturnUrls() {
  const origin = window.location.origin;
  return {
    successUrl: `${origin}/payment/success?checkout_id={CHECKOUT_ID}`,
  };
}
