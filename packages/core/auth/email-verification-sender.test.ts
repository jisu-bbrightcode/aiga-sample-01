import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  injectAuthEmailVerificationSender,
  resetAuthEmailVerificationSenderForTests,
  sendAuthVerificationEmail,
} from "./email-verification-sender";

afterEach(() => {
  resetAuthEmailVerificationSenderForTests();
});

test("delegates auth verification emails to the injected sender", async () => {
  const calls: unknown[] = [];

  injectAuthEmailVerificationSender({
    sendVerificationEmail(input) {
      calls.push(input);
      return Promise.resolve();
    },
  });

  await sendAuthVerificationEmail({
    user: { id: "user-1", email: "new@studio.com", name: "홍길동" },
    url: "http://localhost:3002/api/auth/verify-email?token=abc&callbackURL=/onboarding",
  });

  assert.deepEqual(calls, [
    {
      user: { id: "user-1", email: "new@studio.com", name: "홍길동" },
      url: "http://localhost:3002/api/auth/verify-email?token=abc&callbackURL=/onboarding",
    },
  ]);
});

test("throws in production when the auth email sender is not injected", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";

  try {
    await assert.rejects(
      sendAuthVerificationEmail({
        user: { id: "user-1", email: "new@studio.com", name: "홍길동" },
        url: "http://localhost:3002/api/auth/verify-email?token=abc",
      }),
      /Auth email verification sender is not initialized/,
    );
  } finally {
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
  }
});
