# 관측성 (Observability)

이 레포는 **PostHog** 를 단일 관측 도구로 사용한다 (Sentry 도입 안 함).

## 현 상태

### 에러 트래킹

| 영역 | 위치 | 도구 |
|---|---|---|
| 서버 5xx | `packages/core/error/global-exception.filter.ts` | `captureServerError` (PostHog server) |
| 서버 tRPC `INTERNAL_SERVER_ERROR` | `apps/server/src/main.ts` `onError` | `captureServerError` |
| 클라이언트 window.onerror / unhandledrejection | `packages/core/analytics/global-error-handlers.ts` → 각 앱 `main.tsx` | `captureClientError` (posthog-js) |
| React ErrorBoundary | `packages/core/error/error-boundary.tsx` | `captureClientError` |
| Query/Mutation 실패 | TanStack Query → ErrorBoundary 경유 | ↑ 동일 |

### 등록 위치 (앱 별)

| 앱 | `registerGlobalErrorHandlers` | PostHogProvider |
|---|---|---|
| `apps/app` | ✓ `main.tsx` | ✓ `App.tsx` |
| `apps/admin` | ✓ `main.tsx` (이 PR 에서 추가) | ✓ `App.tsx` |
| `apps/server` | n/a | `initPostHogServer` |

### 분석 / 식별

- `packages/core/analytics/identity.ts` — `useAnalyticsIdentity` hook
- `packages/core/analytics/posthog-provider.tsx`, `client.ts` — 클라이언트 측 init
- `packages/core/analytics/posthog-server.ts` — `initPostHogServer` / `shutdownPostHogServer`
- breadcrumb 버퍼: `packages/core/analytics/client/breadcrumb-buffer.ts` (사용자 액션 기록 → 에러 발생 시 첨부)

### 환경 변수

| 변수 | 위치 |
|---|---|
| `VITE_POSTHOG_API_KEY` / `VITE_POSTHOG_HOST` | 클라이언트 (app, admin) |
| `POSTHOG_API_KEY` / `POSTHOG_HOST` | server |

(landing 은 PostHog 안 씀)

## 안 빠진 것들 점검

- `safeCapture` (재귀 가드) ✓
- `sanitize` / `sanitizeUrl` (PII / 토큰 제거) ✓
- 서버 5xx → server_error 이벤트 ✓
- tRPC 500 → server_error 이벤트 (path 포함) ✓
- 클라이언트 onerror / unhandledrejection ✓
- 클라이언트 ErrorBoundary ✓
- 사용자 식별 (anonymous fallback) ✓

## Neon branch GC

`scripts/neon-gc.mjs` + `.github/workflows/neon-gc.yml` 가 daily 실행 (Secrets 등록 필요).

## 다음 단계 (별 stream)

- **트레이스 / Performance** — PostHog 의 session replay 또는 OpenTelemetry. 우선순위 낮음.
- **알람 채널** — PostHog → Slack/Discord webhook 연결. 운영 합의 후.
- **로그 집계** — 현재 `console.error` 만. 운영에서 어디로 모이는지 (CloudWatch / Vercel logs 등) 별도 확인 필요.
