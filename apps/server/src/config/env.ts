import { z } from "zod";

export const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(3002),
  APP_URL: z.string().url().default("http://localhost:3000"),
  EMAIL_PROVIDER: z.enum(["resend", "ses", "smtp"]).default("resend"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Product Builder <noreply@example.com>"),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_IMAGE_MODEL: z.string().min(1).optional(),
  GEMINI_API_KEY: z.string().min(1).optional(),
  INNGEST_EVENT_KEY: z.string().min(1).optional(),
  INNGEST_SIGNING_KEY: z.string().min(1).optional(),
  BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),
  CLOUDFLARE_ACCOUNT_ID: z.string().min(1).optional(),
  CLOUDFLARE_STREAM_API_TOKEN: z.string().min(1).optional(),
  CLOUDFLARE_STREAM_WEBHOOK_SECRET: z.string().min(1).optional(),
  CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN: z.string().min(1).optional(),
  KCB_ADAPTER_BASE_URL: z.url().optional(),
  KCB_INTERNAL_AUTH_TOKEN: z.string().min(1).optional(),
  KCB_STANDARD_RETURN_URL: z.url().optional(),
  KCB_STANDARD_CALLBACK_URL: z.url().optional(),
  KCB_CUSTOM_MODE_ENABLED: z.enum(["true", "false"]).optional(),
  KCB_RETENTION_DAYS: z.coerce.number().int().positive().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(env: NodeJS.ProcessEnv = process.env): ServerEnv {
  return serverEnvSchema.parse(env);
}
