// Re-export from new location for backwards compatibility

export type { AppErrorOptions, ErrorCodeType } from "../errors";
export {
  AppError,
  AuthError,
  ErrorCode,
  ExternalServiceError,
  errorCodeToHttpStatus,
  getHttpStatus,
  isAppError,
  isOperationalError,
  PermissionError,
  ResourceError,
  ValidationError,
} from "../errors";
