jest.mock("@repo/features/payment", () => {
  const PaymentModule = {
    forRoot(env: Record<string, string>) {
      return { module: PaymentModule, env };
    },
  };

  return {
    PaymentModule,
    isAnyPaymentConfigured: (env: Record<string, string>) =>
      env.POLAR_ACCESS_TOKEN === "polar_oat_x" || env.PAYMENT_INICIS_MID === "INIpayTest",
  };
});

import { PaymentModule } from "@repo/features/payment";
import { getPaymentFeatureWiring } from "./payment-feature";

describe("getPaymentFeatureWiring", () => {
  it("omits PaymentModule when no payment provider env is complete", () => {
    const wiring = getPaymentFeatureWiring({});

    expect(wiring.enabled).toBe(false);
    expect(wiring.imports).toEqual([]);
  });

  it("registers PaymentModule when Polar env is complete", () => {
    const env = {
      POLAR_ACCESS_TOKEN: "polar_oat_x",
      POLAR_ENV: "sandbox",
      POLAR_ORGANIZATION_ID: "org_uuid",
    };
    const wiring = getPaymentFeatureWiring(env);

    expect(wiring.enabled).toBe(true);
    expect(wiring.imports).toEqual([PaymentModule.forRoot(env)]);
  });

  it("registers PaymentModule when only INICIS env is complete", () => {
    const env = { PAYMENT_INICIS_MID: "INIpayTest" };
    const wiring = getPaymentFeatureWiring(env);

    expect(wiring.enabled).toBe(true);
    expect(wiring.imports).toEqual([PaymentModule.forRoot(env)]);
  });
});
