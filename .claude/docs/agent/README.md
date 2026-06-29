---
description: Agent Feature overview and distinction from standard UI+API features
globs: "apps/agent-server/**/*.ts, apps/app/src/features/agent/**/*.ts, apps/app/src/features/agent-desk/**/*.ts"
alwaysApply: false
---

# Agent Feature Rules

> AI Agent 기능 구현 규칙. 표준 UI+API Feature와 구별되는 Agent 고유 패턴을 정의한다.

---

## Agent Feature란?

Agent Feature는 **LLM 기반 실시간 스트리밍, 도구 호출, 프롬프트 관리**가 핵심인 Feature이다.
표준 Feature(CRUD + 페이지)와 달리 **두 개의 서버(server + agent-server)**에 걸쳐 동작한다.

---

## 표준 Feature vs Agent Feature

| 항목 | 표준 Feature | Agent Feature |
|------|-------------|---------------|
| **서버** | server (NestJS) | server + agent-server (Hono) |
| **API 방식** | tRPC + REST | tRPC (CRUD) + SSE (스트리밍) |
| **데이터 흐름** | 요청 → 응답 (단발) | 요청 → 스트림 → 이벤트 연속 |
| **상태 관리** | TanStack Query (서버 상태) | Jotai atoms + useState (스트리밍 상태) |
| **Service 패턴** | NestJS `@Injectable()` 클래스 | 함수형 객체 리터럴 |
| **인증** | NestJS Guard / tRPC middleware | JWT 직접 파싱 + Hono middleware |
| **에러 처리** | NestJS ExceptionFilter | Hono `onError` + 스트림 내 graceful 처리 |

---

## Agent Feature 구성 요소

```
┌─────────────────────────────────┐
│ Client (apps/app/src/features/) │
│  ├── SSE Streaming Hook         │
│  ├── Chat UI / Pipeline UI      │
│  ├── Streaming State (Jotai)    │
│  └── tRPC Hooks (CRUD)          │
├─────────────────────────────────┤
│ agent-server (apps/agent-server)│
│  ├── Hono Route (SSE 스트리밍)  │
│  ├── AI SDK Runtime             │
│  ├── Tool Registry              │
│  ├── Model Router               │
│  └── Prompt Builder             │
├─────────────────────────────────┤
│ server (NestJS)           │
│  ├── tRPC Router (CRUD)         │
│  ├── REST Controller            │
│  └── Credit System API          │
├─────────────────────────────────┤
│ Schema (packages/drizzle)       │
│  └── agent Feature Schema       │
└─────────────────────────────────┘
```

---

## 관련 규칙 파일

| 파일 | 주제 |
|------|------|
| `agent-server.md` | Hono 서버 패턴 (라우트, 서비스, 미들웨어) |
| `streaming.md` | SSE 스트리밍 (서버 + 클라이언트 Hook) |
| `ai-sdk.md` | Vercel AI SDK (streamText, Model Registry, Model Router) |
| `tool-definition.md` | AI Tool 정의 규칙 (네이밍, 레지스트리, Zod 파라미터) |

## 표준 Feature 규칙과의 관계

Agent Feature도 **표준 Feature 규칙을 기본으로 따른다**:

- **Schema**: `feature/schema.md` — `packages/drizzle/src/schema/features/` 중앙 관리
- **Client Feature 구조**: `feature/definition.md` — `apps/app/src/features/` 디렉토리 구조
- **Import/Export**: `feature/dependencies.md` — 의존성 규칙
- **격리**: `feature/isolation.md` — 다른 Feature 수정 금지

**차이점**:
- Server Feature가 `packages/features/` (NestJS) + `apps/agent-server/` (Hono) 두 곳에 분산
- SSE 스트리밍 라우트는 agent-server에서 처리
- CRUD(tRPC/REST)는 server에서 처리

---

## Agent Feature 구현 순서

```
Phase 1: Schema + server CRUD
  → 표준 Feature 규칙 (feature/steps.md Phase 1~2) 동일

Phase 2: agent-server 스트리밍
  → agent-server.md, ai-sdk.md, tool-definition.md 참조

Phase 3: Client Feature
  → streaming.md (SSE Hook), 표준 Frontend 규칙 병행

Phase 4: App 등록
  → 표준 Feature 규칙 (feature/steps.md Phase 4) + agent-server 별도 구동
```

---

## 판별 기준: Agent Feature인가?

| 질문 | Yes → Agent Feature |
|------|---------------------|
| LLM 호출(streamText/generateText)이 필요한가? | Agent Feature |
| SSE 스트리밍 응답이 필요한가? | Agent Feature |
| AI Tool 호출이 필요한가? | Agent Feature |
| agent-server에 라우트가 필요한가? | Agent Feature |
| 프롬프트 관리/컨텍스트 빌딩이 필요한가? | Agent Feature |

위 질문에 모두 No이면 표준 Feature로 구현한다.
