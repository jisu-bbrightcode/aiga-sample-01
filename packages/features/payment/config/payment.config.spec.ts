import { describe, expect, it } from "@jest/globals";
import { isPolarPaymentConfigured, loadPaymentConfig, PaymentConfigError } from "./payment.config";

describe("loadPaymentConfig", () => {
  it("returns config when all env present", () => {
    const cfg = loadPaymentConfig({
      POLAR_ACCESS_TOKEN: "polar_oat_xxx",
      POLAR_ENV: "sandbox",
      POLAR_ORGANIZATION_ID: "org_uuid",
      POLAR_WEBHOOK_SECRET: "whsec_xxx",
    });
    expect(cfg.token).toBe("polar_oat_xxx");
    expect(cfg.env).toBe("sandbox");
    expect(cfg.organizationId).toBe("org_uuid");
    expect(cfg.webhookSecret).toBe("whsec_xxx");
    expect(cfg.apiBaseUrl).toBe("https://sandbox-api.polar.sh");
  });

  it("throws when POLAR_ACCESS_TOKEN missing", () => {
    expect(() => loadPaymentConfig({ POLAR_ENV: "sandbox" })).toThrow(PaymentConfigError);
  });

  it("throws when POLAR_ACCESS_TOKEN does not have polar_oat_ prefix", () => {
    expect(() =>
      loadPaymentConfig({
        POLAR_ACCESS_TOKEN: "bad_token",
        POLAR_ENV: "sandbox",
        POLAR_ORGANIZATION_ID: "x",
      }),
    ).toThrow(PaymentConfigError);
  });

  it("uses production base url when env=production", () => {
    const cfg = loadPaymentConfig({
      POLAR_ACCESS_TOKEN: "polar_oat_x",
      POLAR_ENV: "production",
      POLAR_ORGANIZATION_ID: "x",
      POLAR_WEBHOOK_SECRET: "x",
    });
    expect(cfg.apiBaseUrl).toBe("https://api.polar.sh");
  });

  it("rejects invalid env value", () => {
    expect(() =>
      loadPaymentConfig({
        POLAR_ACCESS_TOKEN: "polar_oat_x",
        POLAR_ENV: "stage",
        POLAR_ORGANIZATION_ID: "x",
        POLAR_WEBHOOK_SECRET: "x",
      }),
    ).toThrow(PaymentConfigError);
  });

  it("allows empty POLAR_WEBHOOK_SECRET (dev / pre-Phase-13)", () => {
    // Phase 13 registers the dashboard webhook; until then the secret
    // is empty in .env.local. Webhook verification (Phase 5) must
    // re-check this at request time.
    const cfg = loadPaymentConfig({
      POLAR_ACCESS_TOKEN: "polar_oat_x",
      POLAR_ENV: "sandbox",
      POLAR_ORGANIZATION_ID: "x",
      POLAR_WEBHOOK_SECRET: "",
    });
    expect(cfg.webhookSecret).toBe("");
  });
});

describe("isPolarPaymentConfigured", () => {
  it("returns false instead of throwing when required env is missing", () => {
    expect(isPolarPaymentConfigured({})).toBe(false);
  });

  it("returns false when Polar token format is invalid", () => {
    expect(
      isPolarPaymentConfigured({
        POLAR_ACCESS_TOKEN: "bad_token",
        POLAR_ENV: "sandbox",
        POLAR_ORGANIZATION_ID: "org_uuid",
      }),
    ).toBe(false);
  });

  it("returns true when Polar env is complete", () => {
    expect(
      isPolarPaymentConfigured({
        POLAR_ACCESS_TOKEN: "polar_oat_x",
        POLAR_ENV: "sandbox",
        POLAR_ORGANIZATION_ID: "org_uuid",
      }),
    ).toBe(true);
  });
});
