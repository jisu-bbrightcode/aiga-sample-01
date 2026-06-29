import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AUTH_ERROR_CODES,
  normalizeAuthErrorCode,
  withNormalizedAuthErrorCode,
} from "./error-codes";

test("maps Better Auth invalid credentials to the app auth error contract", () => {
  assert.equal(
    normalizeAuthErrorCode({
      code: "INVALID_EMAIL_OR_PASSWORD",
      message: "Invalid email or password",
    }),
    AUTH_ERROR_CODES.INVALID_CREDENTIALS,
  );
});

test("preserves an existing app auth error code", () => {
  assert.equal(
    normalizeAuthErrorCode({
      code: "INVALID_EMAIL_OR_PASSWORD",
      errorCode: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
    }),
    AUTH_ERROR_CODES.INVALID_CREDENTIALS,
  );
});

test("falls back to legacy auth messages only for normalization", () => {
  assert.equal(
    normalizeAuthErrorCode({ message: "User already exists. Use another email." }),
    AUTH_ERROR_CODES.EMAIL_ALREADY_EXISTS,
  );
});

test("maps rate-limit status to a stable auth error code", () => {
  assert.equal(normalizeAuthErrorCode({ status: 429 }), AUTH_ERROR_CODES.RATE_LIMITED);
});

test("adds a normalized app error code without removing provider details", () => {
  assert.deepEqual(
    withNormalizedAuthErrorCode({
      code: "TOKEN_EXPIRED",
      message: "Token expired",
    }),
    {
      code: "TOKEN_EXPIRED",
      errorCode: AUTH_ERROR_CODES.INVALID_TOKEN,
      message: "Token expired",
    },
  );
});
