import { z } from "zod";
import { assertProviderFeatureEnvReady } from "../../common/provider-feature-env";

const SOLAPI_BASE_URL = "https://api.solapi.com";
const SOLAPI_PROVIDER_ENV = {
  featureName: "message-sending.solapi",
  enabledKey: "SOLAPI_ENABLED",
  placeholderProtectedKeys: [
    "SOLAPI_API_KEY",
    "SOLAPI_API_SECRET",
    "SOLAPI_DEFAULT_SENDER",
    "SOLAPI_WEBHOOK_SECRET",
  ] as const,
};

export class SolapiConfigError extends Error {
  constructor(message: string) {
    super(`[message-sending.solapi.config] ${message}`);
    this.name = "SolapiConfigError";
  }
}

const solapiEnvSchema = z.object({
  SOLAPI_API_KEY: z.string().min(1),
  SOLAPI_API_SECRET: z.string().min(1),
  SOLAPI_DEFAULT_SENDER: z.string().min(1),
  SOLAPI_WEBHOOK_SECRET: z.string().optional().default(""),
  SOLAPI_API_BASE_URL: z.string().url().optional().default(SOLAPI_BASE_URL),
});

export interface SolapiConfig {
  apiKey: string;
  apiSecret: string;
  defaultSender: string;
  webhookSecret: string;
  apiBaseUrl: string;
}

export function loadSolapiConfig(env: NodeJS.ProcessEnv = process.env): SolapiConfig {
  assertProviderFeatureEnvReady(env, SOLAPI_PROVIDER_ENV);
  const parsed = solapiEnvSchema.safeParse(env);
  if (!parsed.success) {
    const issue = parsed.error.issues[0] ?? { path: ["<root>"], message: "Invalid config" };
    throw new SolapiConfigError(`${issue.path.join(".")} — ${issue.message}`);
  }
  return {
    apiKey: parsed.data.SOLAPI_API_KEY,
    apiSecret: parsed.data.SOLAPI_API_SECRET,
    defaultSender: parsed.data.SOLAPI_DEFAULT_SENDER,
    webhookSecret: parsed.data.SOLAPI_WEBHOOK_SECRET,
    apiBaseUrl: parsed.data.SOLAPI_API_BASE_URL,
  };
}

export function isSolapiConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  try {
    loadSolapiConfig(env);
    return true;
  } catch {
    return false;
  }
}
