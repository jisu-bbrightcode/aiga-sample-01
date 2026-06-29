/**
 * Polar SANDBOX integration smoke test.
 *
 * Gated by `POLAR_INTEGRATION=1` so CI never hits the live API.
 *
 * Usage:
 *   POLAR_INTEGRATION=1 pnpm jest payment/service/polar.adapter.integration
 *
 * Verifies:
 *   1. createCheckout against pro_monthly product returns a polar.sh URL
 *
 * Catalog: docs/superpowers/specs/2026-04-26-payment-system-catalog.json
 *   pro_monthly product id = 9f38c8e4-d920-4e11-818b-d337a2105b24
 */

import { describe, expect, it } from "@jest/globals";
import * as dotenv from "dotenv";
import { PolarAdapter } from "./polar.adapter";
import { loadPaymentConfig } from "../config/payment.config";

dotenv.config({ path: `${__dirname}/../../../../.env.local` });
dotenv.config({ path: `${__dirname}/../../../../.env` });

const PRO_MONTHLY_PRODUCT_ID = "9f38c8e4-d920-4e11-818b-d337a2105b24";

const shouldRun =
  process.env.POLAR_INTEGRATION === "1" &&
  !!process.env.POLAR_ACCESS_TOKEN &&
  !!process.env.POLAR_ORGANIZATION_ID;

const describeIf = shouldRun ? describe : describe.skip;

describeIf("PolarAdapter sandbox integration", () => {
  it("createCheckout against pro_monthly returns a polar.sh URL", async () => {
    const cfg = loadPaymentConfig();
    expect(cfg.env).toBe("sandbox"); // safety: never run against prod
    const adapter = new PolarAdapter(cfg);

    const res = await adapter.createCheckout({
      productId: PRO_MONTHLY_PRODUCT_ID,
      customerEmail: "qa@example.com",
      customerExternalId: `org_smoke_${Date.now()}`,
      successUrl: "https://example.com/billing/success",
      metadata: { phase: "phase_2_smoke" },
    });

    // Don't print the URL — sandbox URLs are session-bound and noisy in logs.
    expect(res.checkoutId).toMatch(/^[a-zA-Z0-9_-]+$/);
    expect(res.url).toMatch(/^https:\/\/(sandbox-api\.|sandbox\.)?polar\.sh\//);
  }, 15_000);
});
