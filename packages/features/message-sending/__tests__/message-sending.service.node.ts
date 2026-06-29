import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collectProviderMessageResults,
  extractCounts,
  extractProductBuilderMessageId,
  isUniqueConstraintViolation,
  mapSolapiMessageStatusCode,
} from "../service/message-sending.service";

describe("MessageSendingService helpers", () => {
  it("extracts the local message id from SOLAPI customFields", () => {
    assert.equal(
      extractProductBuilderMessageId({
        messageId: "provider-message-1",
        customFields: { productBuilderMessageId: "local-message-1" },
      }),
      "local-message-1",
    );
    assert.equal(
      extractProductBuilderMessageId({
        custom_fields: { product_builder_message_id: "local-message-2" },
      }),
      "local-message-2",
    );
  });

  it("maps only explicit SOLAPI terminal statuses to local statuses", () => {
    assert.equal(mapSolapiMessageStatusCode("2000"), "accepted");
    assert.equal(mapSolapiMessageStatusCode("3000"), "sent");
    assert.equal(mapSolapiMessageStatusCode("4000"), "delivered");
    assert.equal(mapSolapiMessageStatusCode("5000"), "failed");
    assert.equal(mapSolapiMessageStatusCode("FAILED"), "failed");
    assert.equal(mapSolapiMessageStatusCode("1010"), "failed");
    assert.equal(mapSolapiMessageStatusCode("2500"), "failed");
    assert.equal(mapSolapiMessageStatusCode("3500"), "failed");
    assert.equal(mapSolapiMessageStatusCode("4500"), undefined);
    assert.equal(mapSolapiMessageStatusCode("UNKNOWN"), undefined);
  });

  it("detects idempotency unique violations from postgres error shapes", () => {
    assert.equal(isUniqueConstraintViolation({ code: "23505" }), true);
    assert.equal(
      isUniqueConstraintViolation({
        cause: { constraint: "idx_msg_send_requests_idempotency" },
      }),
      true,
    );
    assert.equal(isUniqueConstraintViolation({ code: "23503" }), false);
  });

  it("collects successful and failed SOLAPI detail results", () => {
    assert.deepEqual(
      collectProviderMessageResults({
        messageList: [{ messageId: "ok-1", statusCode: "2000" }],
        failedMessageList: [{ messageId: "fail-1", statusCode: "1010" }],
      }),
      [
        { message: { messageId: "ok-1", statusCode: "2000" } },
        { message: { messageId: "fail-1", statusCode: "1010" }, fallbackStatus: "failed" },
      ],
    );
  });

  it("counts registered failures separately from accepted messages", () => {
    assert.deepEqual(
      extractCounts(
        {
          groupInfo: {
            count: {
              total: 3,
              registeredSuccess: 2,
              registeredFailed: 1,
              sentFailed: 0,
            },
          },
        },
        3,
      ),
      { totalCount: 3, acceptedCount: 2, failedCount: 1 },
    );
  });

  it("does not count sent failures as accepted when only sentTotal is returned", () => {
    assert.deepEqual(
      extractCounts(
        {
          groupInfo: {
            count: {
              total: 3,
              sentTotal: 3,
              sentFailed: 1,
            },
          },
        },
        3,
      ),
      { totalCount: 3, acceptedCount: 2, failedCount: 1 },
    );
  });
});
