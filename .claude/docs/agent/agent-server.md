---
description: Agent server (Hono) patterns — routes, services, middleware
globs: "apps/agent-server/**/*.ts"
alwaysApply: false
---

# Agent Server Rules

> agent-server(Hono)의 라우트, 서비스, 미들웨어 패턴

---

## 아키텍처

| 항목 | 값 |
|------|-----|
| **위치** | `apps/agent-server/` |
| **프레임워크** | Hono v4 |
| **런타임** | Node.js (@hono/node-server) |
| **포트** | `AGENT_SERVER_PORT` (기본: 3003) |
| **역할** | SSE 스트리밍 + Agent CRUD (tRPC) |

### server와의 역할 분리

| 서버 | 담당 | 프레임워크 |
|------|------|-----------|
| **server** | 표준 Feature CRUD, 인증, Credit API | NestJS + Fastify |
| **agent-server** | AI 스트리밍, Tool 실행, 모델 라우팅 | Hono |

---

## 디렉토리 구조

```
apps/agent-server/src/
├── main.ts                     # Hono 앱, 라우트/미들웨어 등록
├── env.ts                      # 환경변수 로더
├── lib/
│   ├── auth.ts                 # JWT 파싱, authMiddleware
│   ├── credit-client.ts        # Credit API 클라이언트
│   ├── db.ts                   # Drizzle 연결
│   └── supabase.ts             # Supabase 클라이언트
├── routes/
│   └── chat.ts                 # POST /api/chat/stream (SSE)
├── services/
│   ├── agent.service.ts        # Agent CRUD
│   ├── thread.service.ts       # Thread CRUD
│   ├── message.service.ts      # Message CRUD (cursor 기반)
│   ├── usage.service.ts        # 사용량 통계
│   └── index.ts                # re-export
├── providers/
│   ├── registry.ts             # Model Registry (Anthropic, OpenAI, Google)
│   ├── model-router.ts         # selectModel() 라우팅
│   └── index.ts
├── runtime/
│   ├── agent-runtime.ts        # runAgentStream() — streamText 실행
│   ├── context-builder.ts      # buildSystemPrompt(), buildMessages()
│   └── index.ts
├── tools/
│   ├── tool-registry.ts        # registerTools(), getToolsForAgent()
│   ├── board.tools.ts          # board.* tools
│   ├── community.tools.ts      # community.* tools
│   ├── content-studio.tools.ts # studio.*, content.* tools
│   ├── file.tools.ts           # file.* tools
│   ├── user.tools.ts           # user.* tools
│   ├── image-generation.ts     # image.generate, image.edit
│   └── index.ts
├── trpc/
│   ├── trpc.ts                 # tRPC 인스턴스, procedure 정의
│   ├── router.ts               # agentAppRouter
│   └── index.ts
└── seeds/
    └── blog-writer-agent.ts    # 시드 데이터
```

---

## Service 패턴

NestJS `@Injectable()` 클래스 대신 **함수형 객체 리터럴**을 사용한다.

```typescript
// ✅ agent-server 패턴 — 함수형 서비스
export const agentService = {
  async getById(id: string) {
    return db.query.agentAgents.findFirst({
      where: eq(agentAgents.id, id),
    });
  },

  async create(input: CreateAgentInput) {
    const [created] = await db.insert(agentAgents).values(input).returning();
    return created;
  },
};

// ❌ NestJS 패턴 — agent-server에서 사용 금지
@Injectable()
export class AgentService { ... }
```

### 규칙

- DI 컨테이너 없음: 서비스를 직접 import하여 사용
- DB 접근: `db` 인스턴스를 모듈 레벨에서 import
- 네이밍: `{entity}Service` 객체 리터럴 + `async` 메서드

---

## 라우트 패턴

### SSE 스트리밍 라우트

```typescript
// routes/chat.ts
export const chatRoute = new Hono();

chatRoute.post("/stream", authMiddleware, async (c) => {
  // 1. 입력 검증 (Zod)
  // 2. Credit 사전 확인
  // 3. Agent/Thread/History 로드
  // 4. AI 스트림 실행
  // 5. SSE 이벤트 루프
  // 6. 후처리 (credit 차감, usage 로그)
});
```

### tRPC 라우트

```typescript
// trpc/router.ts
export const agentAppRouter = router({
  agents: router({
    list: publicProcedure.query(...),
    getById: publicProcedure.query(...),
    create: adminProcedure.mutation(...),
  }),
  threads: router({
    list: authProcedure.query(...),
    create: authProcedure.mutation(...),
  }),
  messages: router({
    list: authProcedure.query(...),  // cursor 기반 페이지네이션
  }),
  usage: router({
    summary: adminProcedure.query(...),
  }),
});
```

### main.ts 등록

```typescript
// main.ts
app.route("/api/chat", chatRoute);

app.use("/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/trpc",
    req: c.req.raw,
    router: agentAppRouter,
    createContext: () => ({ ... }),
  });
});
```

---

## 미들웨어

### 등록 순서 (main.ts)

```
1. Global Error Handler (captureServerError → PostHog)
2. otelLogger() — OpenTelemetry 로깅
3. CORS middleware
4. Health check (/health)
5. Route-level: authMiddleware (SSE/tRPC에서 개별 적용)
```

### 인증 미들웨어

```typescript
// lib/auth.ts
export async function authMiddleware(c: Context, next: Next) {
  const user = parseJwtFromHeader(c.req.header("Authorization"));
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  c.set("user", user);
  await next();
}
```

- JWT 직접 파싱 (HMAC-SHA256 서명 검증)
- NestJS Guard 대신 Hono 미들웨어 사용
- `c.set("user", user)`로 컨텍스트 저장

### tRPC Procedure 권한 매핑

| Procedure | 조건 | server 대응 |
|-----------|------|-------------------|
| `publicProcedure` | 없음 | `publicProcedure` |
| `authProcedure` | `ctx.user` 필수 | `protectedProcedure` |
| `adminProcedure` | `ctx.user.role ∈ [admin, owner]` | `adminProcedure` |

---

## 에러 처리

### Global Error Handler

```typescript
app.onError((err, c) => {
  captureServerError({ path, method, statusCode: 500, errorMessage, stack });
  return c.json({ error: { code: "INTERNAL_SERVER_ERROR", ... } }, 500);
});
```

### 스트리밍 중 에러

- 응답이 이미 시작된 후에는 HTTP 상태 코드 변경 불가
- 스트림 내 `event: error`로 에러 전달
- 비차단 후처리 (usage/credit 로그 실패 시 경고만 출력, 스트림 중단 없음)

### Credit 시스템 에러

```
Credit 부족 → 402 (스트림 시작 전)
Credit API 장애 → 경고 로그 후 계속 진행 (graceful degradation)
```

---

## 네이밍 규칙

| 유형 | 패턴 | 예시 |
|------|------|------|
| 파일 | kebab-case | `agent-runtime.ts`, `tool-registry.ts` |
| 서비스 변수 | camelCase 객체 | `agentService`, `threadService` |
| 라우트 변수 | camelCase | `chatRoute` |
| 함수 | camelCase | `runAgentStream`, `buildSystemPrompt` |
| SSE 이벤트 | kebab-case | `text-delta`, `finish` |
| API 경로 | `/{feature}/{action}` | `/api/chat/stream` |

---

## 금지 사항

| 금지 | 이유 |
|------|------|
| NestJS 데코레이터 (`@Injectable`, `@Controller`) | agent-server는 Hono 기반 |
| DI 컨테이너 | 직접 import 패턴 사용 |
| `console.log/error` (라우트/서비스) | `otelLogger` 또는 `createLogger` 사용 |
| 스트리밍 중 동기 차단 | 비동기 처리 필수 |
