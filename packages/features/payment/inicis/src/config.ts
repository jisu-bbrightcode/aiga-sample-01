import { z } from "zod";
import type { InicisConfig } from "./types";

const configSchema = z.object({
  PAYMENT_INICIS_MODE: z.enum(["test", "production"]).default("test"),
  PAYMENT_INICIS_MID: z.string().min(1),
  PAYMENT_INICIS_SIGN_KEY: z.string().min(1),
  PAYMENT_INICIS_INI_API_KEY: z.string().min(1),
  PAYMENT_INICIS_CLIENT_IP: z.string().min(1),
  APP_URL: z.string().url(),
  PAYMENT_INICIS_NOTI_URL: z.string().url().optional(),
  PAYMENT_INICIS_CLOSE_URL: z.string().url().optional(),
  PAYMENT_INICIS_NOTI_ALLOWED_IPS: z.string().optional(),
});

export function loadInicisConfig(env: NodeJS.ProcessEnv = process.env): InicisConfig {
  const parsed = configSchema.parse(env);
  return {
    mode: parsed.PAYMENT_INICIS_MODE,
    mid: parsed.PAYMENT_INICIS_MID,
    signKey: parsed.PAYMENT_INICIS_SIGN_KEY,
    iniApiKey: parsed.PAYMENT_INICIS_INI_API_KEY,
    clientIp: parsed.PAYMENT_INICIS_CLIENT_IP,
    returnBaseUrl: parsed.APP_URL.replace(/\/$/, ""),
    notiUrl: parsed.PAYMENT_INICIS_NOTI_URL,
    closeUrl: parsed.PAYMENT_INICIS_CLOSE_URL,
    notiAllowedIps: parseCsv(parsed.PAYMENT_INICIS_NOTI_ALLOWED_IPS),
  };
}

export function getInicisConfig(env: NodeJS.ProcessEnv = process.env): InicisConfig | null {
  try {
    return loadInicisConfig(env);
  } catch {
    return null;
  }
}

export function isInicisPaymentConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return getInicisConfig(env) !== null;
}

export function getInicisConfigStatus(env: NodeJS.ProcessEnv = process.env) {
  const cfg = getInicisConfig(env);
  return {
    configured: cfg !== null,
    mode: cfg?.mode ?? null,
    midPresent: Boolean(env.PAYMENT_INICIS_MID),
    signKeyPresent: Boolean(env.PAYMENT_INICIS_SIGN_KEY),
    iniApiKeyPresent: Boolean(env.PAYMENT_INICIS_INI_API_KEY),
    clientIpPresent: Boolean(env.PAYMENT_INICIS_CLIENT_IP),
    returnBaseUrl: cfg?.returnBaseUrl ?? null,
    notiUrl: cfg?.notiUrl ?? null,
    closeUrl: cfg?.closeUrl ?? null,
    notiAllowedIpConfigured: Boolean(cfg?.notiAllowedIps.length),
    trustProxy: env.PAYMENT_INICIS_TRUST_PROXY === "true",
    billingBlocked: true,
    billingBlocker: "INILite Key and merchant billing contract are not verified in this workspace.",
  };
}

function parseCsv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
