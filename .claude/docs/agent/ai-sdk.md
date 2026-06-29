---
description: Vercel AI SDK usage — streamText, Model Registry, Model Router
globs: "apps/agent-server/src/runtime/**/*.ts, apps/agent-server/src/providers/**/*.ts"
alwaysApply: false
---

# AI SDK Rules

> Vercel AI SDK v4 사용 규칙 (streamText, Model Registry, Model Router, Context Builder)

---

## 핵심 구성

| 모듈 | 위치 | 역할 |
|------|------|------|
| **Agent Runtime** | `src/runtime/agent-runtime.ts` | `streamText()` 실행, 스트림 반환 |
| **Context Builder** | `src/runtime/context-builder.ts` | 시스템 프롬프트 조립, 메시지 변환 |
| **Model Registry** | `src/providers/registry.ts` | 모델 프로바이더 등록 (Anthropic, OpenAI, Google) |
| **Model Router** | `src/providers/model-router.ts` | 작업 특성에 따른 모델 자동 선택 |

---

## streamText 사용

```typescript
import { streamText } from "ai";

const stream = streamText({
  model,            // registry.languageModel(modelId)
  system,           // buildSystemPrompt() 결과
  messages,         // buildMessages() 결과
  tools,            // getToolsForAgent() 결과
  maxSteps,         // Tool 호출 반복 최대 횟수
  temperature,      // 샘플링 온도
});
```

### 규칙

- `streamText`는 반드시 `agent-runtime.ts`의 `runAgentStream()`을 통해 호출
- 라우트에서 직접 `streamText` 호출 금지
- 반환된 `stream`은 SSE 이벤트로 변환하여 클라이언트에 전달

---

## Model Registry

```typescript
import { createProviderRegistry, customProvider } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";

export const registry = createProviderRegistry({
  anthropic,
  openai,
  google,

  productBuilder: customProvider({
    languageModels: {
      fast: openai("gpt-4o-mini"),
      default: anthropic("claude-sonnet-4-5-20250929"),
      reasoning: anthropic("claude-sonnet-4-5-20250929"),
      "long-context": google("gemini-2.0-flash"),
    },
  }),
});
```

### Model ID 포맷

```
{provider}:{model-name}

anthropic:claude-sonnet-4-5-20250929
openai:gpt-4o-mini
google:gemini-2.0-flash
productBuilder:fast     // Custom alias
productBuilder:default
```

### 규칙

- 새 모델 추가 시 `registry.ts`에만 등록
- Custom alias는 `productBuilder:` 프로바이더에 정의
- 모델 ID는 환경변수가 아닌 코드에서 관리

---

## Model Router

작업 특성에 따라 최적 모델을 자동 선택한다.

```typescript
interface RoutingContext {
  messageLength: number;      // 마지막 메시지 길이
  hasAttachments: boolean;    // 첨부파일 유무
  toolsRequired: string[];   // 활성 Tool 이름 목록
  threadLength: number;       // 대화 히스토리 메시지 수
}
```

### 라우팅 규칙

| 우선순위 | 조건 | 선택 모델 | 이유 |
|---------|------|----------|------|
| 1 | 히스토리 > 50 또는 첨부파일 | `google:gemini-2.0-flash` | 긴 컨텍스트 처리 |
| 2 | 쓰기 Tool 포함 (create/update) | `anthropic:claude-sonnet` | 정확한 추론 |
| 3 | 짧은 질문 (< 100자) + Tool ≤ 1 | `openai:gpt-4o-mini` | 빠른 응답 |
| 4 | 기본 | `anthropic:claude-sonnet` | 범용 |

### 규칙

- `selectModel()`은 `runAgentStream()` 내부에서만 호출
- Agent DB 레코드의 `modelPreference` 필드로 기본값 오버라이드 가능
- 라우팅 로직 변경 시 Model Router 파일만 수정

---

## Context Builder

### 시스템 프롬프트

```typescript
export function buildSystemPrompt(agent: AgentAgent, userName?: string): string {
  const parts: string[] = [agent.systemPrompt];

  if (userName) {
    parts.push(`\n현재 대화 중인 사용자: ${userName}`);
  }

  parts.push(
    "\n도구를 사용할 때는 반드시 사용자의 질문과 관련된 도구만 호출하세요.",
    "도구 결과를 받으면 사용자에게 자연스러운 한국어로 요약하여 전달하세요.",
  );

  return parts.join("\n");
}
```

### 규칙

- Agent의 `systemPrompt` 필드가 기본 프롬프트
- 사용자 이름, Tool 가이드 등 추가 컨텍스트를 `parts`로 조립
- 프롬프트 하드코딩 금지 — DB 또는 설정에서 관리

### 메시지 변환

```typescript
export function buildMessages(dbMessages: AgentMessage[]): CoreMessage[] {
  return dbMessages
    .filter((m) => m.role !== "tool")
    .map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content ?? "",
    }));
}
```

### 규칙

- DB 메시지 → AI SDK `CoreMessage` 포맷 변환
- `tool` role 메시지는 필터링 (AI SDK가 자체 관리)
- `user` / `assistant` 두 role만 전달

---

## Credit 연동

```
Pre-execution:  checkCredits(jwt, MINIMUM_ESTIMATED_CREDITS)
                → 부족 시 402 반환
During:         streamText() 실행
Post-execution: calculateCredits(jwt, modelId, promptTokens, completionTokens)
                → deductCredits(jwt, amount, metadata)
```

### 규칙

- Credit 확인은 스트림 시작 전 (응답 헤더 전송 전)
- Credit 차감은 스트림 완료 후 (실제 사용량 기반)
- Credit API 장애 시 경고 로그만 남기고 계속 진행 (graceful degradation)
- Credit API는 server에 위치 (`/api/internal/credits/`)

---

## 금지 사항

| 금지 | 대안 |
|------|------|
| 라우트에서 직접 `streamText` 호출 | `runAgentStream()` 함수 사용 |
| 모델 ID 하드코딩 | Model Registry 또는 Model Router 사용 |
| 시스템 프롬프트 하드코딩 | Agent DB 레코드 + Context Builder |
| `generateText`로 대체 | 실시간 응답에는 반드시 `streamText` |
| Credit 차감 건너뛰기 | 항상 post-execution 차감 |
