---
description: "Unified error handling patterns for Server (NestJS) and Client (React) - ErrorCode enum, AppError class, Exception Filter, tRPC error middleware, Error Boundary, React Query error config, form error patterns, retry logic"
globs: "**/*.ts, **/*.tsx"
alwaysApply: false
---

# Error Handling Rules

> Server/Client 통합 에러 처리 패턴

---

## 핵심 원칙

| 원칙              | 설명                                      |
| ----------------- | ----------------------------------------- |
| **일관성**        | 모든 레이어에서 동일한 에러 형식 사용     |
| **추적 가능**     | 에러 코드, 컨텍스트로 디버깅 용이         |
| **사용자 친화적** | 기술적 세부사항 숨기고 명확한 메시지 제공 |
| **보안**          | 민감한 정보 노출 방지                     |

---

## ErrorCode 체계

네이밍 규칙: `{DOMAIN}_{CATEGORY}_{SPECIFIC}`

```typescript
// packages/shared/errors/error-codes.ts
export const ErrorCode = {
  // Common
  INTERNAL_ERROR: "INTERNAL_ERROR",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  FORBIDDEN: "FORBIDDEN",
  UNAUTHORIZED: "UNAUTHORIZED",
  RATE_LIMITED: "RATE_LIMITED",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",

  // Auth
  AUTH_INVALID_CREDENTIALS: "AUTH_INVALID_CREDENTIALS",
  AUTH_EMAIL_NOT_VERIFIED: "AUTH_EMAIL_NOT_VERIFIED",
  AUTH_SESSION_EXPIRED: "AUTH_SESSION_EXPIRED",
  AUTH_TOKEN_INVALID: "AUTH_TOKEN_INVALID",
  AUTH_USER_DISABLED: "AUTH_USER_DISABLED",
  AUTH_EMAIL_ALREADY_EXISTS: "AUTH_EMAIL_ALREADY_EXISTS",
  AUTH_WEAK_PASSWORD: "AUTH_WEAK_PASSWORD",

  // Resource
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
  RESOURCE_ALREADY_EXISTS: "RESOURCE_ALREADY_EXISTS",
  RESOURCE_CONFLICT: "RESOURCE_CONFLICT",

  // Permission
  PERMISSION_DENIED: "PERMISSION_DENIED",
  ADMIN_REQUIRED: "ADMIN_REQUIRED",
  OWNER_REQUIRED: "OWNER_REQUIRED",

  // External Service
  EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",
  PAYMENT_FAILED: "PAYMENT_FAILED",
  EMAIL_SEND_FAILED: "EMAIL_SEND_FAILED",
} as const;
```

## HTTP 상태 코드 매핑

```typescript
// packages/shared/errors/http-status.ts
export const errorCodeToHttpStatus: Record<ErrorCode, number> = {
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.AUTH_INVALID_CREDENTIALS]: 401,
  [ErrorCode.AUTH_SESSION_EXPIRED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.PERMISSION_DENIED]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.RESOURCE_NOT_FOUND]: 404,
  [ErrorCode.RESOURCE_ALREADY_EXISTS]: 409,
  [ErrorCode.RESOURCE_CONFLICT]: 409,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: 502,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
};
```

---

## AppError 기본 클래스

```typescript
// packages/shared/errors/app-error.ts
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly context?: Record<string, unknown>;
  public readonly isOperational: boolean;

  constructor(options: {
    code: ErrorCode;
    message: string;
    cause?: Error;
    context?: Record<string, unknown>;
    isOperational?: boolean;
  }) {
    super(options.message);
    this.name = "AppError";
    this.code = options.code;
    this.context = options.context;
    this.isOperational = options.isOperational ?? true;
    if (options.cause) this.cause = options.cause;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      ...(this.context && { details: this.sanitizeContext() }),
    };
  }

  private sanitizeContext() {
    if (!this.context) return undefined;
    const sensitiveKeys = ["password", "token", "secret", "apiKey", "authorization"];
    const sanitized = { ...this.context };
    for (const key of sensitiveKeys) {
      if (key in sanitized) sanitized[key] = "[REDACTED]";
    }
    return sanitized;
  }
}
```

## 도메인별 에러 클래스

```typescript
// packages/shared/errors/domain-errors.ts

// AuthError: Auth 에러 전용
AuthError.invalidCredentials()
AuthError.sessionExpired()
AuthError.emailAlreadyExists(email)

// ResourceError: 리소스 CRUD 에러
ResourceError.notFound(resourceType, id)
ResourceError.alreadyExists(resourceType, identifier)

// PermissionError: 권한 에러
PermissionError.adminRequired()
PermissionError.ownerRequired(resourceType)

// ValidationError: Zod 검증 에러
ValidationError.fromZodError(zodError)
```

## 타입 가드

```typescript
// packages/shared/errors/index.ts
export function isAppError(error: unknown): error is AppError { ... }
export function isOperationalError(error: unknown): boolean { ... }
```

---

## Server: 전역 Exception Filter

```typescript
// packages/core/error/exception.filter.ts
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    // 1. AppError → code/message/details 반환
    // 2. HttpException → NestJS 기본 에러 변환
    // 3. Unknown → INTERNAL_ERROR (프로덕션에서 상세 숨김)
    // 모든 응답에 requestId, timestamp 포함
  }
}

// 등록: apps/server/src/main.ts
app.useGlobalFilters(new GlobalExceptionFilter());
```

## Server: tRPC 에러 처리

```typescript
// packages/core/trpc/error-handler.ts

// AppError → TRPCError 변환 매핑
const codeMap = {
  VALIDATION_ERROR: "BAD_REQUEST",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  RESOURCE_CONFLICT: "CONFLICT",
  RATE_LIMITED: "TOO_MANY_REQUESTS",
  INTERNAL_ERROR: "INTERNAL_SERVER_ERROR",
};

// errorFormatter에서 appErrorCode 포함
errorFormatter({ shape, error }) {
  return {
    ...shape,
    data: {
      ...shape.data,
      appErrorCode: error.cause instanceof AppError
        ? (error.cause as AppError).code
        : undefined,
    },
  };
}

// baseProcedure에 미들웨어 적용
const baseProcedure = t.procedure.use(errorHandlerMiddleware());
```

## Server: Service 에러 발생 패턴

```typescript
@Injectable()
export class FeatureService {
  // 리소스 조회
  async findOrFail(id: string) {
    const item = await this.repository.findById(id);
    if (!item) throw ResourceError.notFound('리소스명', id);
    return item;
  }

  // 권한 검증
  async checkOwnership(resourceId: string, userId: string) {
    const resource = await this.findOrFail(resourceId);
    if (resource.ownerId !== userId) throw PermissionError.ownerRequired('리소스명');
    return resource;
  }

  // 외부 서비스 호출
  async callExternalService(params: ExternalParams) {
    try {
      return await this.externalClient.call(params);
    } catch (error) {
      throw new AppError({
        code: ErrorCode.EXTERNAL_SERVICE_ERROR,
        message: '외부 서비스 연동 중 오류가 발생했습니다',
        cause: error as Error,
        context: { service: 'ServiceName' },
      });
    }
  }
}
```

---

## Client: Error Boundary

```tsx
// packages/core/error/error-boundary.tsx
<ErrorBoundary
  fallback={(error, reset) => <FullPageError error={error} onRetry={reset} />}
  onError={(error, info) => { /* Sentry 등 */ }}
>
  <App />
</ErrorBoundary>
```

## Client: useErrorHandler Hook

```typescript
// packages/core/error/use-error-handler.ts
const handleError = useErrorHandler({
  showToast: true,
  redirectOnUnauthorized: true,
});
// 인증 에러 → /sign-in 리다이렉트 + 토스트
// 기타 에러 → toast.error(message)
```

## Client: React Query 에러 설정

```typescript
// apps/app/src/lib/query-client.ts
new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (isAppError(error) && isAuthError(error.code)) return false;
        return failureCount < 3;
      },
    },
    mutations: { retry: false },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.meta?.skipGlobalErrorHandler) return;
      if (query.state.data !== undefined) return; // 백그라운드 리페치 무시
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.options.onError) return; // 로컬 핸들러 우선
      toast.error(isAppError(error) ? error.message : "요청 처리 중 오류가 발생했습니다");
    },
  }),
});
```

## Client: 폼 에러 처리

```tsx
const onSubmit = async (data: SignInInput) => {
  try {
    await signIn.execute(data.email, data.password);
  } catch (error) {
    if (isAppError(error)) {
      switch (error.code) {
        case ErrorCode.AUTH_INVALID_CREDENTIALS:
          form.setError("password", { message: t("signInInvalidCredentials") });
          break;
        case ErrorCode.AUTH_EMAIL_NOT_VERIFIED:
          toast.warning(t("signInEmailNotVerified"));
          break;
        default:
          toast.error(error.message);
      }
    }
  }
};
```

---

## 로그 레벨

| 레벨      | 사용 상황                     | 예시                             |
| --------- | ----------------------------- | -------------------------------- |
| **error** | 시스템 장애, 예상치 못한 에러 | DB 연결 실패, 외부 API 장애      |
| **warn**  | 복구 가능한 문제              | 재시도 성공, deprecated API 사용 |
| **info**  | 중요 비즈니스 이벤트          | 결제 완료, 회원 가입             |
| **debug** | 개발 디버깅용                 | 요청/응답 상세, 쿼리             |

## 재시도 (Retry)

```typescript
// packages/shared/utils/retry.ts
await withRetry(fn, {
  maxAttempts: 3,
  delayMs: 1000,
  backoff: "exponential",
  shouldRetry: (error) => isRetryableError(error),
});

// 재시도 불가: VALIDATION_ERROR, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, RESOURCE_CONFLICT
// 재시도 가능: 네트워크 에러, 타임아웃, 외부 서비스 에러
```

---

## 체크리스트

### 새 Feature 에러 처리

- [ ] 도메인별 에러 코드 정의 (필요시 ErrorCode에 추가)
- [ ] Service에서 적절한 에러 클래스 사용
- [ ] Client hook에서 에러 처리 로직 구현
- [ ] 사용자 메시지 다국어 처리 (locales)
- [ ] 폼 필드별 에러 표시

### 에러 처리 품질

- [ ] 사용자에게 친화적인 메시지 표시
- [ ] 민감한 정보 노출 방지
- [ ] 적절한 HTTP 상태 코드 반환
- [ ] 에러 로그에 디버깅 컨텍스트 포함
- [ ] 재시도 가능한 에러 식별

---

## 관련 문서

- `.claude/rules/backend/naming-dto.md` - Backend 네이밍 & DTO 규칙
- `.claude/rules/backend/swagger.md` - Swagger/OpenAPI & 모듈 규칙
- `.claude/rules/frontend/data-component.md` - 데이터 관리 & 컴포넌트 규칙
