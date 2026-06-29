import assert from "node:assert/strict";
import test from "node:test";
import { deriveWebhookAssetUpdate } from "./asset-status";

test("webhook status keeps non-ready videos processing", () => {
  const update = deriveWebhookAssetUpdate({
    uid: "video-1",
    readyToStream: false,
    status: { state: "inprogress", pctComplete: "75" },
  });

  assert.equal(update.status, "processing");
  assert.equal(update.readyToStream, false);
  assert.equal(update.eventType, "webhook_processing");
});

test("webhook status marks ready only when readyToStream is true", () => {
  const update = deriveWebhookAssetUpdate({
    uid: "video-1",
    readyToStream: true,
    status: { state: "ready", pctComplete: "100" },
  });

  assert.equal(update.status, "ready");
  assert.equal(update.readyToStream, true);
  assert.equal(update.eventType, "webhook_ready");
});

test("webhook status preserves provider errors as failed", () => {
  const update = deriveWebhookAssetUpdate({
    uid: "video-1",
    readyToStream: false,
    status: { state: "error", errorReasonCode: "ERR", errorReasonText: "failed" },
  });

  assert.equal(update.status, "failed");
  assert.equal(update.readyToStream, false);
  assert.equal(update.eventType, "webhook_failed");
  assert.equal(update.errorCode, "ERR");
});
