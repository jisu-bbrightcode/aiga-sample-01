import assert from "node:assert/strict";
import crypto from "node:crypto";
import { describe, it } from "node:test";
import {
  buildSolapiEventKey,
  maskSolapiPayload,
  normalizeSolapiWebhookPayload,
  verifySolapiWebhookSecret,
} from "../webhook/solapi.webhook";

describe("SOLAPI webhook helpers", () => {
  it("accepts sha1 secret header", () => {
    const configuredSecret = "secret-value";
    const headerSecret = crypto.createHash("sha1").update(configuredSecret).digest("hex");

    assert.equal(verifySolapiWebhookSecret({ configuredSecret, headerSecret }), true);
  });

  it("normalizes array, object and data array payloads", () => {
    assert.equal(normalizeSolapiWebhookPayload([{ messageId: "m1" }]).length, 1);
    assert.equal(normalizeSolapiWebhookPayload({ messageId: "m1" }).length, 1);
    assert.equal(normalizeSolapiWebhookPayload({ data: [{ messageId: "m1" }] }).length, 1);
  });

  it("builds stable idempotency keys from event fields", () => {
    assert.equal(
      buildSolapiEventKey({
        eventType: "message.sent",
        messageId: "message-1",
        statusCode: "2000",
        dateProcessed: "2026-06-13T00:00:00.000Z",
      }),
      "message.sent:message-1:2000:2026-06-13T00:00:00.000Z",
    );
  });

  it("masks phone-like payload fields recursively", () => {
    assert.deepEqual(maskSolapiPayload({ to: "01012345678", nested: { from: "021234567" } }), {
      to: "*******5678",
      nested: { from: "*****4567" },
    });
  });
});
