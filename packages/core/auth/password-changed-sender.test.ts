import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  injectAuthPasswordChangedSender,
  resetAuthPasswordChangedSenderForTests,
  sendAuthPasswordChangedEmail,
} from "./password-changed-sender";

afterEach(() => {
  resetAuthPasswordChangedSenderForTests();
  process.env.NODE_ENV = "test";
});

test("delegates auth password changed emails to the injected sender", async () => {
  const calls: unknown[] = [];

  injectAuthPasswordChangedSender({
    sendPasswordChangedEmail: (input) => {
      calls.push(input);
      return Promise.resolve();
    },
  });

  await sendAuthPasswordChangedEmail({
    user: { id: "user-1", email: "changed@studio.com", name: "홍길동" },
  });

  assert.deepEqual(calls, [
    {
      user: { id: "user-1", email: "changed@studio.com", name: "홍길동" },
    },
  ]);
});

test("throws in production when the auth password changed sender is not injected", async () => {
  process.env.NODE_ENV = "production";

  await assert.rejects(
    () =>
      sendAuthPasswordChangedEmail({
        user: { id: "user-1", email: "changed@studio.com", name: "홍길동" },
      }),
    /Auth password changed sender is not initialized/,
  );
});
