# Core Modules Reference

패키지: `@repo/core` (`packages/core/`)

## Auth (`@repo/core/auth`)

경로: `packages/core/auth/`

### Store (Jotai Atoms)

| 이름                 | 경로            | 설명                                                     |
| -------------------- | --------------- | -------------------------------------------------------- |
| `supabaseAtom`       | `auth/store.ts` | Supabase 클라이언트 인스턴스 atom                        |
| `tokenAtom`          | `auth/store.ts` | 액세스 토큰 (localStorage 동기화)                        |
| `authenticatedAtom`  | `auth/store.ts` | 인증 상태 (null/true/false)                              |
| `sessionAtom`        | `auth/store.ts` | Supabase Session 객체                                    |
| `currentSessionAtom` | `auth/store.ts` | 현재 세션 (없으면 에러)                                  |
| `getSupabaseAtom`    | `auth/store.ts` | Supabase 클라이언트 getter (없으면 에러)                 |
| `profileAtom`        | `auth/store.ts` | 현재 유저 프로필                                         |
| `userRoleAtom`       | `auth/store.ts` | 현재 유저 역할 (derived)                                 |
| `TOKEN_STORAGE_KEY`  | `auth/store.ts` | localStorage 키 상수 (`"_token"`)                        |
| `Profile` (type)     | `auth/store.ts` | 프로필 인터페이스 (id, name, email, avatar, role, dates) |

### Hooks

| 이름               | 경로                                | 설명                           |
| ------------------ | ----------------------------------- | ------------------------------ |
| `useAuthStateSync` | `auth/hooks/use-auth-state-sync.ts` | Supabase 인증 상태 변경 동기화 |
| `useProfileSync`   | `auth/hooks/use-profile-sync.ts`    | 세션 변경 시 프로필 DB 동기화  |

### Better Auth Server 메모

- `auth/server.ts`의 `emailAndPassword.requireEmailVerification`은 운영 환경에서 `true`이며, 개발/테스트 환경에서만 비활성화된다.
- `auth/origins.ts`는 Better Auth `trustedOrigins`와 서버 CORS origin 기본값을 공유한다. `CORS_ORIGINS`가 없을 때 localhost 개발 origin과 Product Builder Vercel 앱 origin을 허용한다.
- `env/local-env.ts`는 로컬 dotenv 파일 로딩 여부를 판별한다. `VERCEL` 환경변수가 있으면 core/auth standalone 설정도 `.env.local` / `.env`를 읽지 않는다.
- `emailVerification.sendOnSignUp: true`로 회원가입 직후 인증 메일을 발송한다. Better Auth 콜백은 `auth/email-verification-sender.ts`의 주입 지점을 호출하고, 서버 `EmailModule`이 `EmailService.sendEmailVerification()`을 주입한다.
- `magicLink` 플러그인은 `auth/magic-link-sender.ts`의 주입 지점을 호출하고, 서버 `EmailModule`이 `EmailService.sendMagicLinkEmail()`을 주입한다. Magic Link verify URL은 API에서 세션 쿠키를 설정한 뒤 callback URL로 이동한다.
- Google 소셜 로그인/가입은 API 서버의 `/api/auth/callback/google`에서 provider callback을 처리한 뒤 클라이언트가 넘긴 프론트 origin 절대 callback URL로 이동한다. 앱과 API가 다른 Vercel origin이어도 최종 이동지가 API root가 되지 않도록 클라이언트에서 절대 URL을 전달한다.
- `emailAndPassword.sendResetPassword`는 `auth/password-reset-sender.ts`의 주입 지점을 호출하고, 서버 `EmailModule`이 `EmailService.sendPasswordResetEmail()`을 주입한다. Better Auth가 생성한 callback URL과 token으로 프론트 `/reset-password?token=...` 링크를 만들어 메일 템플릿에 전달한다.
- `emailAndPassword.onPasswordReset`은 `auth/password-changed-sender.ts`의 주입 지점을 호출하고, 서버 `EmailModule`이 `EmailService.sendPasswordChangedEmail()`을 주입한다. 발송 실패는 reset 결과를 깨지 않도록 서버 로그로 기록한다.
- 앱의 이메일 회원가입 화면은 성공 후 `/magic-link` 인증 안내로 이동하고, 재발송은 `sendVerificationEmail`을 호출한다.
- `auth/error-codes.ts`는 Better Auth provider code를 앱 표준 `AUTH_*` error code로 정규화한다. 서버 `/api/auth/*` catch-all은 4xx/5xx JSON 응답에 `errorCode`를 추가하고, 프론트는 서버 `message`를 직접 렌더링하지 않고 locale별 i18n key로만 표시한다.

### Guards (React Components)

| 이름               | 경로                          | 설명                                                     |
| ------------------ | ----------------------------- | -------------------------------------------------------- |
| `AuthGuard`        | `auth/guards/auth-guard.tsx`  | 인증 유저만 접근 허용                                    |
| `AdminGuard`       | `auth/guards/admin-guard.tsx` | admin/owner 역할만 허용 (allowedRoles 커스터마이즈 가능) |
| `AdminRole` (type) | `auth/guards/admin-guard.tsx` | `"owner" \| "admin"`                                     |

---

## Storage (`@repo/core/storage/blob`)

경로: `packages/core/storage/blob.ts`

| 이름 | 설명 |
| ---- | ---- |
| `uploadDataUrlToBlob(dataUrl, prefix, options?)` | base64 data URL을 Vercel Blob에 업로드하고 public URL/path/content-type/size를 반환한다 |
| `uploadBufferToBlob(buffer, key, contentType, options?)` | 서버에서 이미 받은 Buffer/Uint8Array를 Vercel Blob에 업로드한다. Story entity `imageSmallUrl` 업로드는 이 경로를 사용한다 |
| `deleteBlob(url)` | 교체/삭제 후 남은 Vercel Blob public URL을 제거한다. 404는 idempotent하게 무시한다 |

---

## tRPC (`@repo/core/trpc`)

경로: `packages/core/trpc/`

| 이름                     | 경로                      | 설명                                           |
| ------------------------ | ------------------------- | ---------------------------------------------- |
| `router`                 | `trpc/trpc.ts`            | tRPC 라우터 팩토리                             |
| `publicProcedure`        | `trpc/trpc.ts`            | 공개 프로시저 (인증 불필요)                    |
| `authProcedure`          | `trpc/trpc.ts`            | 인증 프로시저 (ctx.user 필수)                  |
| `protectedProcedure`     | `trpc/trpc.ts`            | authProcedure alias                            |
| `middleware`             | `trpc/trpc.ts`            | 미들웨어 팩토리                                |
| `adminProcedure`         | `trpc/admin-procedure.ts` | 관리자 전용 프로시저 (인증 + admin/owner 역할) |
| `getAuthUserId(ctx)`     | `trpc/trpc.ts`            | 컨텍스트에서 인증된 userId 추출                |
| `BaseTRPCContext` (type) | `trpc/trpc.ts`            | 기본 컨텍스트 타입 (db, user, services)        |
| `User` (type)            | `trpc/trpc.ts`            | 유저 인터페이스 (id, email, role, roleIds)     |

---

## NestJS Auth (`@repo/core/nestjs/auth`)

경로: `packages/core/nestjs/auth/`

| 이름                             | 경로                                    | 설명                                      |
| -------------------------------- | --------------------------------------- | ----------------------------------------- |
| `JwtAuthGuard`                   | `nestjs/auth/jwt-auth.guard.ts`         | JWT 인증 가드 (NestJS CanActivate)        |
| `NestAdminGuard`                 | `nestjs/auth/admin.guard.ts`            | 관리자 역할 가드 (user_roles 테이블 확인) |
| `CurrentUser` (decorator)        | `nestjs/auth/current-user.decorator.ts` | 인증 유저를 파라미터에 주입               |
| `parseJwtFromHeader(authHeader)` | `nestjs/auth/jwt-parser.ts`             | Authorization 헤더에서 JWT 파싱           |

---

## i18n (`@repo/core/i18n`)

경로: `packages/core/i18n/`

| 이름                               | 경로                              | 설명                             |
| ---------------------------------- | --------------------------------- | -------------------------------- |
| `createI18n(config)`               | `i18n/create-i18n.ts`             | i18n 인스턴스 생성               |
| `getOrCreateI18n(config)`          | `i18n/create-i18n.ts`             | 싱글턴 패턴 getter               |
| `getI18n()`                        | `i18n/create-i18n.ts`             | 기존 i18n 인스턴스 조회          |
| `useFeatureTranslation(namespace)` | `i18n/use-feature-translation.ts` | feature 스코프 번역 훅           |
| `getTranslation(namespace)`        | `i18n/get-translation.ts`         | 컴포넌트 외부에서 번역 함수 조회 |
| `getUserFacingErrorMessage(t, error, options)` | `i18n/user-facing-error.ts` | 사용자 노출 에러 문구를 raw `Error.message` 대신 안정적인 `code`/`errorCode` 기반 i18n key 또는 fallback key로 변환 |
| `getUserFacingErrorCode(error)` | `i18n/user-facing-error.ts` | 직접 `code`/`errorCode`, tRPC `data.code`, `shape.data.code`에서 사용자 표시용 매핑 코드를 추출 |
| `I18nextProvider`                  | re-export                         | react-i18next Provider           |
| `useTranslation`                   | re-export                         | react-i18next 훅                 |
| `Language` (type)                  | `i18n/types.ts`                   | `"ko" \| "en"`                   |
| `I18nConfig` (type)                | `i18n/types.ts`                   | i18n 설정 인터페이스             |

사용자에게 노출되는 toast/alert/inline error는 서버 `message`나 `Error.message`를 직접 렌더링하지 않는다. 앱 레이어는 `apps/app/src/lib/user-facing-error.ts`의 `getAppErrorMessage`, widget 레이어는 `packages/widgets/src/common/user-facing-error.ts`의 `getWidgetErrorMessage`를 사용해 namespace별 fallback key와 code map을 적용한다. 문구는 상태 코드, 토큰, provider 사유 같은 기술 표현을 피하고, 사용자가 이해할 수 있는 상황 설명과 다음 행동을 짧고 친절하게 안내한다.

---

## Theme (`@repo/core/theme`)

경로: `packages/core/theme/`

| 이름                | 경로                       | 설명                                               |
| ------------------- | -------------------------- | -------------------------------------------------- |
| `themeAtom`         | `theme/store.ts`           | 사용자 테마 모드 atom (localStorage "theme" 연동)  |
| `resolvedThemeAtom` | `theme/store.ts`           | system 모드 해석 후 실제 테마 ("light" \| "dark")  |
| `THEME_STORAGE_KEY` | `theme/store.ts`           | localStorage 키 상수 (`"theme"`)                   |
| `ThemeMode` (type)  | `theme/store.ts`           | `"light" \| "dark" \| "system"`                    |
| `useTheme`          | `theme/use-theme.ts`       | 테마 읽기/변경 훅 (theme, setTheme, resolvedTheme) |
| `ThemeProvider`     | `theme/theme-provider.tsx` | `.dark` 클래스 토글 + OS 설정 변경 감지 Provider   |

---

## Rate Limit (`@repo/core/rate-limit`)

경로: `packages/core/rate-limit/`

| 이름                     | 경로                               | 설명                                         |
| ------------------------ | ---------------------------------- | -------------------------------------------- |
| `RateLimitService`       | `rate-limit/rate-limit.service.ts` | NestJS Injectable 레이트 리밋 서비스         |
| `RateLimitConfig` (type) | `rate-limit/rate-limit.service.ts` | 설정 (action, maxRequests, windowSeconds)    |
| `RateLimitResult` (type) | `rate-limit/rate-limit.service.ts` | 결과 (allowed, remaining, retryAfterSeconds) |

메서드:

- `check(identifier, config)` — 토큰 확인 및 소비
- `assertRateLimit(identifier, config)` — 초과 시 TRPCError 발생
- `cleanup(olderThanSeconds)` — 오래된 레코드 정리

---

## Analytics (`@repo/core/analytics`, `@repo/core/analytics/client`)

경로: `packages/core/analytics/`

### 서버 (`@repo/core/analytics`)

| 이름                        | 경로                          | 설명                                  |
| --------------------------- | ----------------------------- | ------------------------------------- |
| `initPostHogServer(config)` | `analytics/posthog-server.ts` | PostHog Node 클라이언트 싱글톤 초기화 |
| `getPostHogServer()`        | `analytics/posthog-server.ts` | 초기화된 PostHog 인스턴스 반환        |
| `captureServerError(event)` | `analytics/capture-server.ts` | `server_error` 이벤트 캡처 (5xx 에러) |
| `captureServerEvent(input)` | `analytics/capture-server-event.ts` | 서버/webhook 발 비즈니스 이벤트 캡처 (distinctId/event/properties/groups). sanitize + no-throw |
| `shutdownPostHogServer()`   | `analytics/posthog-server.ts` | PostHog 플러시 후 종료                |
| `ANALYTICS_EVENTS`          | `analytics/events.ts`         | 비즈니스 행동 이벤트 이름 중앙 상수 |
| `ServerErrorEvent` (type)   | `analytics/types.ts`          | 서버 에러 이벤트 인터페이스           |
| `PostHogConfig` (type)      | `analytics/types.ts`          | PostHog 설정 (apiKey, host)           |

### 클라이언트 (`@repo/core/analytics/client`)

| 이름                               | 경로                             | 설명                                        |
| ---------------------------------- | -------------------------------- | ------------------------------------------- |
| `PostHogProvider`                  | `analytics/posthog-provider.tsx` | React PostHog Provider (pageview 자동 캡처, PostHog Surveys 결정 응답 활성) |
| `identifyUser(userId, props)`      | `analytics/identity.ts`          | PostHog `$identify` 호출 (익명→로그인 alias 1회 포함) |
| `resetUser()`                      | `analytics/identity.ts`          | PostHog `reset` 호출 (로그아웃 시)          |
| `captureClientError(error, props)` | `analytics/capture-client.ts`    | `client_error` 이벤트 캡처                  |
| `captureEvent(event, props)`       | `analytics/capture-event.ts`     | 비즈니스 행동 이벤트 캡처 (SSR-safe, no-throw). `ANALYTICS_EVENTS` 상수 사용 권장 |
| `setProjectGroup(projectId, props)`| `analytics/capture-event.ts`     | PostHog group analytics — 이후 capture 가 project 그룹에 귀속 |
| `registerSuperProperties(props)`   | `analytics/capture-event.ts`     | 전 이벤트 공통 super property 등록 (surface 등) |

### 이벤트 정의

| 이벤트         | 출처       | 트리거            | 데이터                                                    |
| -------------- | ---------- | ----------------- | --------------------------------------------------------- |
| `server_error` | 서버       | 5xx 에러          | path, method, statusCode, errorMessage, requestId, userId |
| `client_error` | 클라이언트 | API 에러, JS 에러 | error.message, error.code, path                           |
| `$pageview`    | 클라이언트 | 자동 (posthog-js) | URL, referrer                                             |
| `$identify`    | 클라이언트 | 로그인 성공       | userId, email                                             |
| `survey sent` | 클라이언트 | 우상단 툴바 피드백 제출 | `$survey_id`, `$survey_name`, `$survey_questions`, `$survey_completed`, `$survey_response_<question_id>`, feedback_type, message, rating |

#### 비즈니스 행동 이벤트

`ANALYTICS_EVENTS` 상수 + `captureEvent`/`captureServerEvent` 로 발행.

| 영역 | 이벤트 | 발행 위치 |
| ---- | ------ | --------- |
| Activation | `signup_completed` | server `auth/server.ts` user.create.after (email+OAuth 단일) |
| Activation | `onboarding_step_completed` · `onboarding_completed` | `onboarding/hooks/use-onboarding.ts` |
| Activation | `project_created`(+`setProjectGroup`) · `project_opened` | `project/hooks/use-project-mutations.ts` · `project/pages/project-list-page.tsx` |
| Activation | `entity_created` · `draft_created` | `story/components/create-entity-dialog.tsx` |
| Retention | `entity_updated` | `story/pages/entity-detail-page.tsx` (autosave flush) |
| Paths/Stickiness | `entity_viewed` | `entity-detail-page.tsx` |
| AI | `ai_chat_message_sent` | `story/pages/chat-page.tsx` (operator chat surface) |
| super prop | `surface`(web/electron) | `auth/hooks/use-analytics-identity.ts` |
| Monetization | `pricing_viewed`·`checkout_started`·`subscription_activated` | ⚠️ 미배선 — payment freeze 가드 |

---

## Error (`@repo/core/error`, `@repo/core/error/client`)

경로: `packages/core/error/`

### 서버 (`@repo/core/error`)

| 이름                    | 경로                               | 설명                                                                    |
| ----------------------- | ---------------------------------- | ----------------------------------------------------------------------- |
| `GlobalExceptionFilter` | `error/global-exception.filter.ts` | NestJS `@Catch()` 글로벌 예외 필터 (HttpException + AppError + unknown) |

**응답 형식**: `{ error: { code, message, statusCode, timestamp, path, requestId } }`. 처리 흐름: HttpException → 구조화 응답 / AppError → HTTP 매핑 / Unknown → 500 generic. 5xx는 PostHog `server_error` 자동 캡처.

### 클라이언트 (`@repo/core/error/client`)

| 이름            | 경로                       | 설명                                                        |
| --------------- | -------------------------- | ----------------------------------------------------------- |
| `ErrorBoundary` | `error/error-boundary.tsx` | React Error Boundary (렌더링 에러 → PostHog 캡처 + 폴백 UI) |

---

## Product Builder Data Runtime

현재 Product Builder 기준 문서: `docs/reference/product-builder-data-runtime-policy.md`

Product Builder는 서버 권위 데이터 경로를 기준으로 한다.

규칙:

- 데이터의 canonical source는 서버 DB와 서버 API 검증 경로다.
- 클라이언트 캐시는 허용되지만 성능 보조 수단이다. 캐시는 서버 데이터를 대체하지 않는다.
- 로컬 DB를 canonical source로 두지 않는다.

구현 지침:

- API 계약, 권한, validation, persistence는 서버 feature module에서 먼저 정의한다.
- 프론트엔드는 서버 API client와 query/mutation cache를 통해 데이터를 소비한다.
- optimistic UI는 가능하지만 commit은 서버 API 성공을 기준으로 한다.

---

## Empty Directories (예약됨)

- `packages/core/config/` — 미사용
- `packages/core/logger/` — 미사용
