import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  injectAuthPasswordResetSender,
  resetAuthPasswordResetSenderForTests,
  sendAuthPasswordResetEmail,
} from "./password-reset-sender";

afterEach(() => {
  resetAuthPasswordResetSenderForTests();
});

test("delegates auth password reset emails to the injected sender", async () => {
  const calls: unknown[] = [];

  injectAuthPasswordResetSender({
    sendPasswordResetEmail(input) {
      calls.push(input);
      return Promise.resolve();
    },
  });

  await sendAuthPasswordResetEmail({
    user: { id: "user-1", email: "reset@studio.com", name: "홍길동" },
    token: "reset-token",
    url: "http://localhost:3002/api/auth/reset-password/reset-token?callbackURL=/reset-password",
  });

  assert.deepEqual(calls, [
    {
      user: { id: "user-1", email: "reset@studio.com", name: "홍길동" },
      token: "reset-token",
      url: "http://localhost:3002/api/auth/reset-password/reset-token?callbackURL=/reset-password",
    },
  ]);
});

test("throws in production when the auth password reset sender is not injected", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";

  try {
    await assert.rejects(
      sendAuthPasswordResetEmail({
        user: { id: "user-1", email: "reset@studio.com", name: "홍길동" },
        token: "reset-token",
        url: "http://localhost:3002/api/auth/reset-password/reset-token",
      }),
      /Auth password reset sender is not initialized/,
    );
  } finally {
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
  }
});
