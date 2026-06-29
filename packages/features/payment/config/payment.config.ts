/**
 * Payment / Polar environment configuration.
 *
 * Validates the four POLAR_* env vars via zod and resolves the API base URL
 * from `POLAR_ENV`. `loadPaymentConfig()` is intentionally strict for the
 * payment feature path, while app-level boot can call `isPaymentConfigured()`
 * so missing payment-provider env does not block core auth/API routes.
 *
 * Webhook-secret handling
 * -----------------------
 * `POLAR_WEBHOOK_SECRET` is allowed to be empty during early development
 * (Phase 2~4) — it is filled in once we register the Polar dashboard
 * webhook (Phase 13). The value is therefore declared `optional()` here.
 *
 * **Webhook signature verification (added in Phase 5) MUST guard against an
 * empty secret** by re-checking `cfg.webhookSecret` and refusing to verify
 * when it is empty. We intentionally do not enforce min(1) here so the rest
 * of the payment surface can boot in dev without the dashboard hooked up.
 */

import { z } from "zod";

export class PaymentConfigError extends Error {
  constructor(msg: string) {
    super(`[payment.config] ${msg}`);
    this.name = "PaymentConfigError";
  }
}

const schema = z.object({
  POLAR_ACCESS_TOKEN: z.string().startsWith("polar_oat_", "must start with polar_oat_"),
  POLAR_ENV: z.enum(["sandbox", "production"]),
  POLAR_ORGANIZATION_ID: z.string().min(1),
  // intentionally optional — see header note. Default to "" so consumers
  // get a stable string field.
  POLAR_WEBHOOK_SECRET: z.string().optional().default(""),
});

export interface PaymentConfig {
  token: string;
  env: "sandbox" | "production";
  organizationId: string;
  webhookSecret: string;
  apiBaseUrl: string;
}

export function loadPaymentConfig(env: NodeJS.ProcessEnv = process.env): PaymentConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const issue = parsed.error.issues[0] ?? {
      path: ["<root>"],
      message: "Invalid payment configuration",
    };
    throw new PaymentConfigError(`${issue.path.join(".")} — ${issue.message}`);
  }
  const { POLAR_ACCESS_TOKEN, POLAR_ENV, POLAR_ORGANIZATION_ID, POLAR_WEBHOOK_SECRET } =
    parsed.data;
  return {
    token: POLAR_ACCESS_TOKEN,
    env: POLAR_ENV,
    organizationId: POLAR_ORGANIZATION_ID,
    webhookSecret: POLAR_WEBHOOK_SECRET,
    apiBaseUrl: POLAR_ENV === "sandbox" ? "https://sandbox-api.polar.sh" : "https://api.polar.sh",
  };
}

export function isPolarPaymentConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  try {
    loadPaymentConfig(env);
    return true;
  } catch {
    return false;
  }
}

/**
 * @deprecated Use `isPolarPaymentConfigured` so provider-specific checks do not
 * accidentally gate unrelated payment rails.
 */
export const isPaymentConfigured = isPolarPaymentConfigured;
