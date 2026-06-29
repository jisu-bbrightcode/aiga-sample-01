# Logging System Design

> PostHog Logs (OpenTelemetry) + DB Audit Log 2계층 로깅 아키텍처

## 결정 사항

| 항목 | 결정 |
|------|------|
| Application Logging | PostHog Logs (OTLP HTTP) |
| Audit Trail | DB `system_audit_logs` (기존 유지) |
| 프로토콜 | OpenTelemetry (벤더 비종속) |
| 로거 위치 | `packages/core/logger/` |
| 환경변수 | `LOG_LEVEL` 추가 (기존 PostHog 키 재활용) |

## 아키텍처

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ Vite React  │  │ NestJS      │  │ Hono Agent  │
│ (Vercel)    │  │ (Railway)   │  │ (Vercel/RW) │
│ posthog-js  │  │ OTEL SDK    │  │ OTEL SDK    │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │ sessionId       │ OTLP HTTP      │ OTLP HTTP
       └────────┬────────┴────────────────┘
                ▼
        ┌──────────────┐
        │   PostHog    │  Analytics + Logs + Session Replay + Error
        └──────────────┘
별도: PostgreSQL system_audit_logs (컴플라이언스)
```

## 패키지 구조

```
packages/core/logger/
├── index.ts                           # Public API (서버용)
├── types.ts                           # LogLevel, LogAttributes
├── otel-setup.ts                      # OpenTelemetry SDK + PostHog OTLP
├── create-logger.ts                   # createLogger(namespace) 팩토리
├── nestjs/
│   ├── logger.module.ts               # NestJS LoggerModule.forRoot()
│   ├── request-logger.interceptor.ts  # HTTP 자동 로깅
│   └── index.ts
├── hono/
│   ├── logger-middleware.ts           # Hono 자동 로깅
│   └── index.ts
└── client/
    ├── session-header.ts              # sessionId 헤더 주입
    └── index.ts
```

## 환경변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `POSTHOG_API_KEY` | - | 기존 키 재활용 |
| `POSTHOG_HOST` | `https://us.i.posthog.com` | 기존 |
| `LOG_LEVEL` | `info` | trace/debug/info/warn/error |

## 로그 레벨

| Level | Production | Development | 용도 |
|-------|-----------|-------------|------|
| error | ✅ | ✅ | 시스템 장애, 500 에러 |
| warn | ✅ | ✅ | 비정상이지만 복구 가능 |
| info | ✅ | ✅ | 비즈니스 이벤트 (CRUD) |
| debug | ❌ | ✅ | SQL 쿼리, 캐시, 내부 흐름 |

## 로그 속성 스키마

### 자동 주입 (Interceptor/Middleware)

```
service.name, service.version, deployment.environment
http.method, http.route, http.status_code, http.duration_ms
request.id, user.id, user.role, session.id, posthog.distinct_id
error.type, error.message, error.stack (에러 시)
```

### 수동 (Service 비즈니스 로그)

네임스페이스: `{feature}.{entity}_{field}`

```typescript
logger.info("Post published", { "blog.post_id": id, "blog.slug": slug });
logger.error("Payment failed", { "payment.order_id": id, "error.type": "TimeoutError" });
```

## 시스템별 연결

### NestJS (server)

- `initOtelSdk({ serviceName: "server" })` in main.ts
- `RequestLoggerInterceptor` 글로벌 등록
- Service에서 `createLogger("blog")` 사용

### Hono (agent-server)

- `initOtelSdk({ serviceName: "agent-server" })` in main.ts
- `otelLogger()` 미들웨어 등록 (기존 `logger()` 교체)

### Vite React (클라이언트)

- tRPC httpBatchLink headers에 `getSessionHeaders()` 추가
- 추가 패키지 없음

## 비용 최적화

- health check 경로 제외
- production에서 debug/trace OFF
- 요청/응답 body 미포함
- 민감 정보 필터링

## 마이그레이션

| 기존 | 변경 |
|------|------|
| `console.error` in tRPC onError | OTEL 자동 캡처 |
| `captureServerError()` | 유지 + Logs 이중 기록 |
| Hono `logger()` | `otelLogger()` 교체 |
| 부트스트랩 console.log | 유지 (서버 시작 로그) |

## 필요 패키지

```
@opentelemetry/sdk-node
@opentelemetry/exporter-logs-otlp-http
@opentelemetry/api-logs
@opentelemetry/resources
@opentelemetry/sdk-logs
```

## 관련 문서

- Discovery: Obsidian `Product Builder/기획 관리 대시보드/00-Discovery/로깅 시스템.md`
- PRD: Obsidian `Product Builder/기획 관리 대시보드/01-PRD/PRD-로깅 시스템.md`
- FRD: Obsidian `Product Builder/기획 관리 대시보드/02-FRD/로깅 시스템/FRD-로깅 시스템.md`
- 규칙: `.claude/rules/backend/logging.md`
