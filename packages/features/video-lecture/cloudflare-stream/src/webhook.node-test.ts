import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import { parseWebhookSignature, verifyCloudflareStreamWebhookSignature } from "./webhook";

describe("Cloudflare Stream webhook signature", () => {
  it("parses time and sig1 from Webhook-Signature", () => {
    assert.deepEqual(parseWebhookSignature("time=1230811200,sig1=abc123"), {
      time: 1230811200,
      sig1: "abc123",
    });
  });

  it("verifies HMAC-SHA256 over time dot raw body", () => {
    const rawBody = Buffer.from('{"uid":"video_1"}');
    const secret = "stream_secret";
    const time = 1230811200;
    const sig1 = createHmac("sha256", secret)
      .update(Buffer.concat([Buffer.from(`${time}.`), rawBody]))
      .digest("hex");

    assert.equal(
      verifyCloudflareStreamWebhookSignature({
        rawBody,
        signatureHeader: `time=${time},sig1=${sig1}`,
        secret,
        nowSeconds: time,
      }),
      true,
    );
  });

  it("rejects stale signatures", () => {
    assert.equal(
      verifyCloudflareStreamWebhookSignature({
        rawBody: "{}",
        signatureHeader: "time=100,sig1=00",
        secret: "stream_secret",
        nowSeconds: 1000,
      }),
      false,
    );
  });
});
