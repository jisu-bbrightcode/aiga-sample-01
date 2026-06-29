import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Resend webhook signature verification.
 *
 * Resend signs webhooks with the Svix / Standard Webhooks scheme
 * (https://resend.com/docs/dashboard/webhooks/verify-webhooks-requests):
 *   - headers: `svix-id`, `svix-timestamp`, `svix-signature`
 *   - secret format: `whsec_<base64>` — the HMAC key is the base64-decoded
 *     bytes AFTER the `whsec_` prefix (this differs from Polar's raw-UTF8 key,
 *     see payment/controller/public/polar-webhook.controller.ts).
 *   - signed content: `${id}.${timestamp}.${rawBody}`
 *   - signature header: space-separated `v1,<base64sig>` tokens; any match wins.
 *
 * Replay protection: the signed timestamp must be within the tolerance window.
 */

const SVIX_PREFIX = "whsec_";
const DEFAULT_TOLERANCE_SECONDS = 5 * 60;

export interface ResendWebhookHeaders {
  "svix-id"?: string;
  "svix-timestamp"?: string;
  "svix-signature"?: string;
}

export interface VerifyResendSignatureParams {
  rawBody: string | Buffer;
  headers: Record<string, string | string[] | undefined>;
  secret: string;
  nowSeconds?: number;
  toleranceSeconds?: number;
}

export type VerifyResendSignatureResult =
  | { valid: true }
  | { valid: false; reason: string };

/**
 * Lower-case header lookup that tolerates string | string[] | undefined.
 * Accepts both `svix-*` (Resend default) and `webhook-*` (Standard Webhooks)
 * header names so the verifier works regardless of proxy header rewriting.
 */
function readHeader(
  headers: Record<string, string | string[] | undefined>,
  ...names: string[]
): string | null {
  for (const name of names) {
    const value = headers[name] ?? headers[name.toLowerCase()];
    if (typeof value === "string" && value.length > 0) return value;
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === "string") {
      return value[0];
    }
  }
  return null;
}

/** Decode the HMAC key from a `whsec_`-prefixed secret. */
export function decodeResendSecret(secret: string): Buffer {
  const base64 = secret.startsWith(SVIX_PREFIX) ? secret.slice(SVIX_PREFIX.length) : secret;
  return Buffer.from(base64, "base64");
}

export function verifyResendWebhookSignature(
  params: VerifyResendSignatureParams,
): VerifyResendSignatureResult {
  const id = readHeader(params.headers, "svix-id", "webhook-id");
  const timestamp = readHeader(params.headers, "svix-timestamp", "webhook-timestamp");
  const signatureHeader = readHeader(params.headers, "svix-signature", "webhook-signature");

  if (!id || !timestamp || !signatureHeader) {
    return { valid: false, reason: "missing_webhook_headers" };
  }

  const tsNum = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(tsNum)) {
    return { valid: false, reason: "invalid_timestamp" };
  }

  const now = params.nowSeconds ?? Math.floor(Date.now() / 1000);
  const tolerance = params.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  if (Math.abs(now - tsNum) > tolerance) {
    return { valid: false, reason: "timestamp_out_of_range" };
  }

  const body = Buffer.isBuffer(params.rawBody)
    ? params.rawBody.toString("utf8")
    : params.rawBody;
  const signedContent = `${id}.${timestamp}.${body}`;
  const key = decodeResendSecret(params.secret);
  const expected = createHmac("sha256", key).update(signedContent).digest();

  // Header value is space-separated: "v1,<sig> v1,<sig2>". Each token may use a
  // versioned prefix ("v1,"); compare the base64 portion only.
  const candidates = signatureHeader
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .map((token) => (token.includes(",") ? token.slice(token.indexOf(",") + 1) : token));

  const valid = candidates.some((candidate) => {
    let got: Buffer;
    try {
      got = Buffer.from(candidate, "base64");
    } catch {
      return false;
    }
    return got.length === expected.length && timingSafeEqual(got, expected);
  });

  return valid ? { valid: true } : { valid: false, reason: "invalid_signature" };
}
