import { getUserFacingErrorMessage, type UserFacingTranslate } from "@repo/core/i18n";

const WIDGET_ERROR_CODE_KEYS: Readonly<Record<string, string>> = {
  BAD_REQUEST: "errors.invalidRequest",
  CONFLICT: "errors.conflict",
  FORBIDDEN: "errors.forbidden",
  NOT_FOUND: "errors.notFound",
  PRECONDITION_FAILED: "errors.invalidRequest",
  TOO_MANY_REQUESTS: "errors.rateLimited",
  UNAUTHORIZED: "errors.unauthorized",
  UNPROCESSABLE_CONTENT: "errors.invalidRequest",
};

export function getWidgetErrorMessage(
  t: UserFacingTranslate,
  error: unknown,
  fallbackKey = "errors.generic",
) {
  return getUserFacingErrorMessage(t, error, {
    fallbackKey,
    codeMap: WIDGET_ERROR_CODE_KEYS,
  });
}
