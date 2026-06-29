import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  injectAuthMagicLinkSender,
  resetAuthMagicLinkSenderForTests,
  sendAuthMagicLinkEmail,
} from "./magic-link-sender";

afterEach(() => {
  resetAuthMagicLinkSenderForTests();
  process.env.NODE_ENV = "test";
});

test("delegates auth magic link emails to the injected sender", async () => {
  const calls: unknown[] = [];

  injectAuthMagicLinkSender({
    sendMagicLinkEmail: (input) => {
      calls.push(input);
      return Promise.resolve();
    },
  });

  await sendAuthMagicLinkEmail({
    email: "magic@studio.com",
    token: "magic-token",
    url: "http://localhost:3002/api/auth/magic-link/verify?token=magic-token&callbackURL=/",
  });

  assert.deepEqual(calls, [
    {
      email: "magic@studio.com",
      token: "magic-token",
      url: "http://localhost:3002/api/auth/magic-link/verify?token=magic-token&callbackURL=/",
    },
  ]);
});

test("throws in production when the auth magic link sender is not injected", async () => {
  process.env.NODE_ENV = "production";

  await assert.rejects(
    () =>
      sendAuthMagicLinkEmail({
        email: "magic@studio.com",
        token: "magic-token",
        url: "http://localhost:3002/api/auth/magic-link/verify?token=magic-token",
      }),
    /Auth magic link sender is not initialized/,
  );
});
