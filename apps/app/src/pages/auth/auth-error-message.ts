import {
  AUTH_ERROR_CODES,
  type AuthErrorCode,
  type AuthErrorLike,
  normalizeAuthErrorCode,
} from "@repo/core/auth/error-codes";

type Translate = (key: string) => string;

const AUTH_ERROR_I18N_KEYS: Partial<Record<AuthErrorCode, string>> = {
  [AUTH_ERROR_CODES.INVALID_CREDENTIALS]: "authError.invalidCredentials",
  [AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED]: "authError.emailNotVerified",
  [AUTH_ERROR_CODES.EMAIL_ALREADY_EXISTS]: "authError.emailAlreadyExists",
  [AUTH_ERROR_CODES.INVALID_EMAIL]: "authError.invalidEmail",
  [AUTH_ERROR_CODES.INVALID_PASSWORD]: "authError.invalidPassword",
  [AUTH_ERROR_CODES.PASSWORD_TOO_SHORT]: "authError.passwordTooShort",
  [AUTH_ERROR_CODES.PASSWORD_TOO_LONG]: "authError.passwordTooLong",
  [AUTH_ERROR_CODES.INVALID_TOKEN]: "authError.invalidToken",
  [AUTH_ERROR_CODES.RATE_LIMITED]: "authError.rateLimited",
  [AUTH_ERROR_CODES.WORKSPACE_ACCESS_DENIED]: "authError.workspaceAccessDenied",
  [AUTH_ERROR_CODES.OPERATION_FAILED]: "authError.operationFailed",
  [AUTH_ERROR_CODES.SERVER_UNAVAILABLE]: "common.serverUnavailable",
};

export function getAuthErrorMessage(
  t: Translate,
  error: AuthErrorLike | null | undefined,
  fallbackKey: string,
) {
  const code = normalizeAuthErrorCode(error);
  const i18nKey = AUTH_ERROR_I18N_KEYS[code] ?? fallbackKey;
  return t(i18nKey);
}

export function authErrorMatches(error: AuthErrorLike | null | undefined, code: AuthErrorCode) {
  return normalizeAuthErrorCode(error) === code;
}
