import { createHmac } from "node:crypto";
import { decodeResendSecret, verifyResendWebhookSignature } from "./resend-signature";

/**
 * Build a valid Svix/Standard-Webhooks signature for the given body so the
 * tests exercise the real HMAC path without a live Resend secret.
 */
function sign(params: {
  secret: string;
  id: string;
  timestamp: number;
  body: string;
}): string {
  const key = decodeResendSecret(params.secret);
  const signed = `${params.id}.${params.timestamp}.${params.body}`;
  const sig = createHmac("sha256", key).update(signed).digest("base64");
  return `v1,${sig}`;
}

describe("verifyResendWebhookSignature", () => {
  // `whsec_` + base64("super-secret-key-material-0123456789")
  const secret = `whsec_${Buffer.from("super-secret-key-material-0123456789").toString("base64")}`;
  const id = "msg_2abc";
  const now = 1_700_000_000;
  const body = JSON.stringify({ type: "email.delivered", data: { email_id: "e1" } });

  function headers(overrides: Record<string, string> = {}) {
    return {
      "svix-id": id,
      "svix-timestamp": String(now),
      "svix-signature": sign({ secret, id, timestamp: now, body }),
      ...overrides,
    };
  }

  it("accepts a correctly signed payload", () => {
    const result = verifyResendWebhookSignature({
      rawBody: body,
      headers: headers(),
      secret,
      nowSeconds: now,
    });
    expect(result.valid).toBe(true);
  });

  it("accepts webhook-* header aliases", () => {
    const result = verifyResendWebhookSignature({
      rawBody: body,
      headers: {
        "webhook-id": id,
        "webhook-timestamp": String(now),
        "webhook-signature": sign({ secret, id, timestamp: now, body }),
      },
      secret,
      nowSeconds: now,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a tampered body", () => {
    const result = verifyResendWebhookSignature({
      rawBody: `${body} `,
      headers: headers(),
      secret,
      nowSeconds: now,
    });
    expect(result).toEqual({ valid: false, reason: "invalid_signature" });
  });

  it("rejects a wrong secret", () => {
    const result = verifyResendWebhookSignature({
      rawBody: body,
      headers: headers(),
      secret: `whsec_${Buffer.from("different-secret").toString("base64")}`,
      nowSeconds: now,
    });
    expect(result).toEqual({ valid: false, reason: "invalid_signature" });
  });

  it("rejects an out-of-window timestamp (replay protection)", () => {
    const result = verifyResendWebhookSignature({
      rawBody: body,
      headers: headers(),
      secret,
      nowSeconds: now + 10 * 60,
    });
    expect(result).toEqual({ valid: false, reason: "timestamp_out_of_range" });
  });

  it("rejects missing headers", () => {
    const result = verifyResendWebhookSignature({
      rawBody: body,
      headers: { "svix-id": id },
      secret,
      nowSeconds: now,
    });
    expect(result).toEqual({ valid: false, reason: "missing_webhook_headers" });
  });

  it("rejects a non-numeric timestamp", () => {
    const result = verifyResendWebhookSignature({
      rawBody: body,
      headers: headers({ "svix-timestamp": "not-a-number" }),
      secret,
      nowSeconds: now,
    });
    expect(result).toEqual({ valid: false, reason: "invalid_timestamp" });
  });

  it("matches one signature among space-separated candidates", () => {
    const good = sign({ secret, id, timestamp: now, body });
    const result = verifyResendWebhookSignature({
      rawBody: body,
      headers: headers({ "svix-signature": `v1,deadbeef ${good}` }),
      secret,
      nowSeconds: now,
    });
    expect(result.valid).toBe(true);
  });
});
