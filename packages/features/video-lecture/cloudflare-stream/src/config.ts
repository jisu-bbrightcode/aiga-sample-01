import { z } from "zod";
import type { CloudflareStreamConfig } from "./types";

const configSchema = z.object({
  CLOUDFLARE_ACCOUNT_ID: z.string().min(1),
  CLOUDFLARE_STREAM_API_TOKEN: z.string().min(1),
  CLOUDFLARE_STREAM_WEBHOOK_SECRET: z.string().min(1),
  CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN: z.string().optional(),
});

export function loadCloudflareStreamConfig(
  env: NodeJS.ProcessEnv = process.env,
): CloudflareStreamConfig {
  const parsed = configSchema.safeParse(env);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path.join(".") || "CLOUDFLARE_STREAM_*";
    throw new Error(`VIDEO_LECTURE_PROVIDER_CONFIG_MISSING:${field}`);
  }

  return {
    accountId: parsed.data.CLOUDFLARE_ACCOUNT_ID,
    apiToken: parsed.data.CLOUDFLARE_STREAM_API_TOKEN,
    webhookSecret: parsed.data.CLOUDFLARE_STREAM_WEBHOOK_SECRET,
    customerSubdomain: parsed.data.CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN,
  };
}

export function isCloudflareStreamConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  try {
    loadCloudflareStreamConfig(env);
    return true;
  } catch {
    return false;
  }
}
