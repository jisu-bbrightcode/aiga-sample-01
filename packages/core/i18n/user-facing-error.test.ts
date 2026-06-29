import assert from "node:assert/strict";
import test from "node:test";
import { getUserFacingErrorCode, getUserFacingErrorMessage } from "./user-facing-error";

const t = (key: string) => `translated:${key}`;

test("getUserFacingErrorMessage masks raw Error.message", () => {
  const message = getUserFacingErrorMessage(t, new Error("서버 원문 오류"), {
    fallbackKey: "errors.generic",
  });

  assert.equal(message, "translated:errors.generic");
});

test("getUserFacingErrorMessage maps stable error codes to i18n keys", () => {
  const message = getUserFacingErrorMessage(
    t,
    { errorCode: "WORKSPACE_ACCESS_DENIED", message: "workspace denied" },
    {
      fallbackKey: "errors.generic",
      codeMap: {
        WORKSPACE_ACCESS_DENIED: "errors.workspaceAccessDenied",
      },
    },
  );

  assert.equal(message, "translated:errors.workspaceAccessDenied");
});

test("getUserFacingErrorCode reads nested tRPC data code before message", () => {
  const code = getUserFacingErrorCode({
    message: "결제 실패",
    data: { code: "UNPROCESSABLE_CONTENT" },
  });

  assert.equal(code, "UNPROCESSABLE_CONTENT");
});
