import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { buildPasswordResetUrl } from "./password-reset-url";

afterEach(() => {
  delete process.env.APP_URL;
});

test("builds a frontend reset URL from the Better Auth callback URL", () => {
  const resetUrl = buildPasswordResetUrl(
    "http://localhost:3002/api/auth/reset-password/reset-token?callbackURL=http%3A%2F%2Flocalhost%3A3000%2Freset-password",
    "reset-token",
  );

  assert.equal(resetUrl, "http://localhost:3000/reset-password?token=reset-token");
});

test("uses APP_URL as the base for relative reset callback URLs", () => {
  process.env.APP_URL = "http://localhost:3000";

  const resetUrl = buildPasswordResetUrl(
    "http://localhost:3002/api/auth/reset-password/reset-token?callbackURL=%2Freset-password",
    "reset-token",
  );

  assert.equal(resetUrl, "http://localhost:3000/reset-password?token=reset-token");
});

test("keeps the Better Auth URL when callbackURL is missing", () => {
  const authUrl = "http://localhost:3002/api/auth/reset-password/reset-token";

  assert.equal(buildPasswordResetUrl(authUrl, "reset-token"), authUrl);
});
