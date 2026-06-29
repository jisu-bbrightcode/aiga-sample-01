export const AUTH_ERROR_CODES = {
  INVALID_CREDENTIALS: "AUTH_INVALID_CREDENTIALS",
  EMAIL_NOT_VERIFIED: "AUTH_EMAIL_NOT_VERIFIED",
  EMAIL_ALREADY_EXISTS: "AUTH_EMAIL_ALREADY_EXISTS",
  INVALID_EMAIL: "AUTH_INVALID_EMAIL",
  INVALID_PASSWORD: "AUTH_INVALID_PASSWORD",
  PASSWORD_TOO_SHORT: "AUTH_PASSWORD_TOO_SHORT",
  PASSWORD_TOO_LONG: "AUTH_PASSWORD_TOO_LONG",
  INVALID_TOKEN: "AUTH_INVALID_TOKEN",
  RATE_LIMITED: "AUTH_RATE_LIMITED",
  WORKSPACE_ACCESS_DENIED: "AUTH_WORKSPACE_ACCESS_DENIED",
  OPERATION_FAILED: "AUTH_OPERATION_FAILED",
  SERVER_UNAVAILABLE: "AUTH_SERVER_UNAVAILABLE",
  UNKNOWN: "AUTH_UNKNOWN",
} as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES];

export interface AuthErrorLike {
  code?: unknown;
  errorCode?: unknown;
  message?: unknown;
  status?: unknown;
  statusCode?: unknown;
}

const AUTH_ERROR_CODE_VALUES = new Set<string>(Object.values(AUTH_ERROR_CODES));

const PROVIDER_CODE_MAP: Record<string, AuthErrorCode> = {
  ACCOUNT_NOT_FOUND: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
  CREDENTIAL_ACCOUNT_NOT_FOUND: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
  INVALID_EMAIL_OR_PASSWORD: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
  USER_NOT_FOUND: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
  EMAIL_NOT_VERIFIED: AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED,
  USER_ALREADY_EXISTS: AUTH_ERROR_CODES.EMAIL_ALREADY_EXISTS,
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: AUTH_ERROR_CODES.EMAIL_ALREADY_EXISTS,
  INVALID_EMAIL: AUTH_ERROR_CODES.INVALID_EMAIL,
  INVALID_PASSWORD: AUTH_ERROR_CODES.INVALID_PASSWORD,
  PASSWORD_TOO_SHORT: AUTH_ERROR_CODES.PASSWORD_TOO_SHORT,
  PASSWORD_TOO_LONG: AUTH_ERROR_CODES.PASSWORD_TOO_LONG,
  INVALID_TOKEN: AUTH_ERROR_CODES.INVALID_TOKEN,
  SESSION_EXPIRED: AUTH_ERROR_CODES.INVALID_TOKEN,
  TOKEN_EXPIRED: AUTH_ERROR_CODES.INVALID_TOKEN,
  EXPIRED_TOKEN: AUTH_ERROR_CODES.INVALID_TOKEN,
  ORGANIZATION_NOT_FOUND: AUTH_ERROR_CODES.WORKSPACE_ACCESS_DENIED,
  USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION: AUTH_ERROR_CODES.WORKSPACE_ACCESS_DENIED,
  USER_IS_NOT_A_MEMBER: AUTH_ERROR_CODES.WORKSPACE_ACCESS_DENIED,
  FAILED_TO_CREATE_ORGANIZATION: AUTH_ERROR_CODES.OPERATION_FAILED,
  FAILED_TO_CREATE_SESSION: AUTH_ERROR_CODES.OPERATION_FAILED,
  FAILED_TO_CREATE_USER: AUTH_ERROR_CODES.OPERATION_FAILED,
  FAILED_TO_CREATE_VERIFICATION: AUTH_ERROR_CODES.OPERATION_FAILED,
  INTERNAL_AUTH_ERROR: AUTH_ERROR_CODES.SERVER_UNAVAILABLE,
};

const MESSAGE_PATTERNS: [RegExp, AuthErrorCode][] = [
  [/invalid email or password/i, AUTH_ERROR_CODES.INVALID_CREDENTIALS],
  [/email not verified/i, AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED],
  [/user already exists/i, AUTH_ERROR_CODES.EMAIL_ALREADY_EXISTS],
  [/password too short/i, AUTH_ERROR_CODES.PASSWORD_TOO_SHORT],
  [/password too long/i, AUTH_ERROR_CODES.PASSWORD_TOO_LONG],
  [/token expired|expired token|invalid token/i, AUTH_ERROR_CODES.INVALID_TOKEN],
];

export function isAuthErrorCode(value: unknown): value is AuthErrorCode {
  return typeof value === "string" && AUTH_ERROR_CODE_VALUES.has(value);
}

export function normalizeAuthErrorCode(error?: AuthErrorLike | null): AuthErrorCode {
  if (!error) return AUTH_ERROR_CODES.UNKNOWN;

  if (isAuthErrorCode(error.errorCode)) return error.errorCode;
  if (isAuthErrorCode(error.code)) return error.code;

  const providerCode = readString(error.code);
  if (providerCode) {
    const mappedCode = PROVIDER_CODE_MAP[providerCode];
    if (mappedCode) return mappedCode;
  }

  const status = readStatus(error);
  if (status === 429) return AUTH_ERROR_CODES.RATE_LIMITED;
  if (status && status >= 500) return AUTH_ERROR_CODES.SERVER_UNAVAILABLE;

  const message = readString(error.message);
  if (message) {
    const matchedPattern = MESSAGE_PATTERNS.find(([pattern]) => pattern.test(message));
    if (matchedPattern) return matchedPattern[1];
  }

  return AUTH_ERROR_CODES.UNKNOWN;
}

export function withNormalizedAuthErrorCode<T extends AuthErrorLike>(
  error: T,
): T & { errorCode: AuthErrorCode } {
  return {
    ...error,
    errorCode: normalizeAuthErrorCode(error),
  };
}

function readString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readStatus(error: AuthErrorLike) {
  const status = typeof error.status === "number" ? error.status : error.statusCode;
  return typeof status === "number" ? status : null;
}
