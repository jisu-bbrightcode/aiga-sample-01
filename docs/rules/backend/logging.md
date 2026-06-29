# Logging Rules

> PostHog Logs (OpenTelemetry) 기반 구조화 로깅 규칙

## 핵심 원칙

| 원칙 | 설명 |
|------|------|
| **console 금지** | `console.log/error/warn/debug` 사용 금지 (부트스트랩 제외). `createLogger()` 사용 |
| **구조화 필수** | 문자열 연결 금지, 항상 속성 객체로 전달 |
| **자동 + 수동** | 요청/에러는 Interceptor가 자동, 비즈니스 이벤트는 Service에서 수동 |
| **민감 정보 금지** | password, token, 카드번호, email body 등 절대 포함 금지 |

---

## Logger 사용법

### 1. Logger 생성

```typescript
import { createLogger } from "@repo/core/logger";

const logger = createLogger("blog"); // Feature 이름 = namespace
```

### 2. 비즈니스 이벤트 로깅 (Service CRUD 메서드)

```typescript
// create/update/delete/toggle 등 데이터 변경 메서드에 필수
async publishPost(id: string) {
  const post = await this.findById(id);
  await this.db.update(posts).set({ isPublished: true }).where(eq(posts.id, id));

  logger.info("Post published", {
    "blog.post_id": id,
    "blog.slug": post.slug,
    "user.id": post.authorId,
  });

  return this.findById(id);
}
```

### 3. 에러 로깅

```typescript
// 비즈니스 에러 (외부 API 실패 등)
try {
  await externalApi.charge(orderId);
} catch (error) {
  logger.error("Payment charge failed", {
    "payment.order_id": orderId,
    "payment.provider": "toss",
    "error.type": error.constructor.name,
    "error.message": error.message,
  });
  throw error;
}
```

---

## 로그 레벨 사용 기준

| Level | 사용 시점 | 예시 |
|-------|----------|------|
| `error` | 시스템 장애, 500 에러, 외부 API 실패 | DB 연결 실패, 결제 API 타임아웃 |
| `warn` | 비정상이지만 복구 가능 | Rate limit 접근, deprecated API 호출 |
| `info` | 주요 비즈니스 이벤트 | 게시물 발행, 결제 완료, 유저 가입 |
| `debug` | 상세 디버깅 (production OFF) | SQL 쿼리, 캐시 hit/miss |

---

## 메시지 포맷 규칙

### 메시지 문자열

```typescript
// ✅ 좋은 예시 — 완료형, 간결
"Post published"
"Payment completed"
"User signed in"
"Agent execution failed"

// ❌ 나쁜 예시
"publishing post..."          // 진행형 금지
"post published: uuid-123"    // 데이터를 메시지에 넣지 않음
"ERROR: something went wrong" // 레벨 접두사 금지
```

### 속성 네이밍

```typescript
// ✅ {feature}.{entity}_{field} (snake_case)
"blog.post_id": "uuid-123"
"payment.order_id": "order-789"
"agent.tokens_used": 1523

// ❌ camelCase, 비구조화
"postId": "uuid-123"          // 네임스페이스 없음
"blog.postId": "uuid-123"     // camelCase 금지
```

### 네임스페이스 규칙

`{feature}.{entity}_{field}` 형식:

```
blog.post_id, blog.slug, blog.author_id
payment.order_id, payment.amount, payment.provider
agent.agent_id, agent.model, agent.tokens_used
auth.session_id, auth.method
```

---

## Feature 개발 시 로깅 체크리스트

새 Feature 또는 기존 Feature 수정 시 반드시 확인:

- [ ] Service 파일 상단에 `const logger = createLogger("{feature}");` 선언
- [ ] `create` 메서드에 `logger.info("{Entity} created", { ... })` 추가
- [ ] `update` 메서드에 `logger.info("{Entity} updated", { ... })` 추가
- [ ] `delete` 메서드에 `logger.info("{Entity} deleted", { ... })` 추가
- [ ] 외부 API 호출 시 try/catch에서 `logger.error()` 추가
- [ ] `console.log/error` 사용하지 않았는지 확인
- [ ] 민감 정보(password, token 등)가 로그에 포함되지 않는지 확인

---

## 자동 로깅 (건드릴 필요 없음)

아래 항목은 Interceptor/Middleware가 자동으로 처리하므로 Service에서 중복 로깅하지 않는다:

| 항목 | 담당 |
|------|------|
| HTTP 요청/응답 (method, route, status, duration) | `RequestLoggerInterceptor` (NestJS) |
| HTTP 요청/응답 | `otelLogger()` (Hono) |
| 미처리 에러 + stack trace | `GlobalExceptionFilter` |
| request.id 생성 | Interceptor/Middleware 자동 |
| user.id, user.role 추출 | Interceptor (JWT에서 자동) |
| session.id 추출 | Interceptor (x-posthog-session-id 헤더에서 자동) |

---

## 금지 목록

| 금지 | 대안 |
|------|------|
| `console.log()` | `logger.info()` |
| `console.error()` | `logger.error()` |
| `console.warn()` | `logger.warn()` |
| 문자열 연결 `"error: " + msg` | 속성 객체 `{ "error.message": msg }` |
| 민감 정보 로깅 | 제외 또는 마스킹 |
| health check 로깅 | Interceptor에서 `/health` 자동 제외 |

---

## 관련 문서

- 설계: `docs/plans/2026-02-23-logging-system-design.md`
- FRD: Obsidian `Product Builder/기획 관리 대시보드/02-FRD/로깅 시스템/FRD-로깅 시스템.md`
- 패키지: `packages/core/logger/`
