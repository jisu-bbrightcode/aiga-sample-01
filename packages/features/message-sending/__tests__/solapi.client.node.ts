import assert from "node:assert/strict";
import crypto from "node:crypto";
import { describe, it } from "node:test";
import { SolapiClient } from "../provider/solapi.client";

const config = {
  apiKey: "test-api-key",
  apiSecret: "test-api-secret",
  defaultSender: "021234567",
  webhookSecret: "webhook-secret",
  apiBaseUrl: "https://api.solapi.com",
};

describe("SolapiClient", () => {
  it("builds SOLAPI HMAC-SHA256 authorization header", () => {
    const date = new Date("2026-06-13T00:00:00.000Z");
    const salt = "fixed-salt";
    const expectedSignature = crypto
      .createHmac("sha256", config.apiSecret)
      .update(date.toISOString() + salt)
      .digest("hex");

    const client = new SolapiClient(config, {
      now: () => date,
      salt: () => salt,
    });

    assert.equal(
      client.buildAuthorizationHeader(),
      `HMAC-SHA256 apiKey=${config.apiKey}, date=${date.toISOString()}, salt=${salt}, signature=${expectedSignature}`,
    );
  });

  it("posts to send-many/detail with generated auth header", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;
    const client = new SolapiClient(config, {
      now: () => new Date("2026-06-13T00:00:00.000Z"),
      salt: () => "fixed-salt",
      fetchImpl: ((url: string | URL | Request, init?: RequestInit) => {
        capturedUrl = String(url);
        capturedInit = init;
        return Promise.resolve(
          new Response(JSON.stringify({ groupInfo: { _id: "group-1" } }), { status: 200 }),
        );
      }) as typeof fetch,
    });

    await client.sendManyDetail({
      messages: [{ to: "01012345678", from: "021234567", text: "hello" }],
      showMessageList: true,
    });

    assert.equal(capturedUrl, "https://api.solapi.com/messages/v4/send-many/detail");
    assert.equal(capturedInit?.method, "POST");
    assert.equal(
      (capturedInit?.headers as Record<string, string>)["Content-Type"],
      "application/json",
    );
    assert.match(
      String((capturedInit?.headers as Record<string, string>).Authorization),
      /^HMAC-SHA256 apiKey=test-api-key, date=2026-06-13T00:00:00\.000Z, salt=fixed-salt, signature=/,
    );
    assert.deepEqual(JSON.parse(String(capturedInit?.body)), {
      messages: [{ to: "01012345678", from: "021234567", text: "hello" }],
      showMessageList: true,
    });
  });
});
