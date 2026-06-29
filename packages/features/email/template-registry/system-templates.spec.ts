import { isSystemTemplateKey, SYSTEM_TEMPLATE_KEYS } from "./system-templates";

/**
 * Pins the protected system-template contract (PB-NOTI-EMAIL-API-DELETE-001 /
 * BBR-660). The key set must stay in sync with the seed catalog; this test is
 * the drift guard.
 */
describe("system-templates", () => {
  it("protects exactly the seeded code-bound template keys", () => {
    expect([...SYSTEM_TEMPLATE_KEYS].sort()).toEqual(
      [
        "auth.email-verification",
        "auth.welcome",
        "password.password-changed",
        "password.password-reset",
        "transactional.notification",
      ].sort(),
    );
  });

  it("returns true for a seeded system key", () => {
    expect(isSystemTemplateKey("auth.welcome")).toBe(true);
    expect(isSystemTemplateKey("password.password-reset")).toBe(true);
  });

  it("returns false for an admin-created custom key", () => {
    expect(isSystemTemplateKey("marketing.custom-blast")).toBe(false);
    expect(isSystemTemplateKey("transactional.order-confirmed")).toBe(false);
  });

  it("does not treat an unknown key sharing a renderer suffix as system", () => {
    // `marketing.notification` resolves to the notification renderer but is NOT a
    // protected seed key — protection is by exact key, not renderer suffix.
    expect(isSystemTemplateKey("marketing.notification")).toBe(false);
  });
});
