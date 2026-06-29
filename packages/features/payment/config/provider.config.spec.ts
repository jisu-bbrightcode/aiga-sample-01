import { isAnyPaymentConfigured } from "./provider.config";

const inicisEnv = {
  APP_URL: "https://example.test",
  PAYMENT_INICIS_MID: "INIpayTest",
  PAYMENT_INICIS_SIGN_KEY: "sign-key",
  PAYMENT_INICIS_INI_API_KEY: "api-key",
  PAYMENT_INICIS_CLIENT_IP: "127.0.0.1",
};

describe("isAnyPaymentConfigured", () => {
  it("returns false when no provider env is complete", () => {
    expect(isAnyPaymentConfigured({})).toBe(false);
  });

  it("returns true when only Polar env is complete", () => {
    expect(
      isAnyPaymentConfigured({
        POLAR_ACCESS_TOKEN: "polar_oat_x",
        POLAR_ENV: "sandbox",
        POLAR_ORGANIZATION_ID: "org_uuid",
      }),
    ).toBe(true);
  });

  it("returns true when only INICIS env is complete", () => {
    expect(isAnyPaymentConfigured(inicisEnv)).toBe(true);
  });

  it("returns true when both provider env sets are complete", () => {
    expect(
      isAnyPaymentConfigured({
        ...inicisEnv,
        POLAR_ACCESS_TOKEN: "polar_oat_x",
        POLAR_ENV: "sandbox",
        POLAR_ORGANIZATION_ID: "org_uuid",
      }),
    ).toBe(true);
  });
});
