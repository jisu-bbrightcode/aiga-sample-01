---
description: SSE streaming patterns — server-side and client-side hooks
globs: "apps/agent-server/src/routes/**/*.ts, apps/app/src/features/agent/**/*.ts, apps/app/src/features/agent-desk/**/*.ts, packages/ui/src/hooks/use-sse-stream.ts"
alwaysApply: false
---

# SSE Streaming Rules

> 서버 → 클라이언트 실시간 스트리밍 패턴 (Server-Sent Events)

---

## 전체 흐름

```
Client                          agent-server
  │                                  │
  │── POST /api/chat/stream ────────>│
  │                                  │── Credit 사전 확인
  │                                  │── Agent/Thread 로드
  │                                  │── streamText() 실행
  │<── event: thread ───────────────│
  │<── event: text-delta ───────────│ (반복)
  │<── event: text-delta ───────────│
  │<── event: finish ───────────────│
  │                                  │── Credit 차감
  │                                  │── Usage 로깅
```

---

## 서버 SSE 패턴

### 응답 헤더

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

### 이벤트 포맷

```
event: {event-name}
data: {json-string}

```

- `event` 필드로 이벤트 타입 구분
- `data` 필드는 반드시 JSON 문자열
- 이벤트 사이 빈 줄(`\n\n`)로 구분

### 표준 이벤트 타입

| 이벤트 | 시점 | data 내용 |
|--------|------|-----------|
| `thread` | 스트림 시작 | `{ threadId }` |
| `text-delta` | 텍스트 청크 생성 | `{ text }` |
| `finish` | 스트림 완료 | `{ threadId, usage }` |
| `error` | 에러 발생 | `{ message, code }` |

### 실행(Execution) 이벤트 타입

| 이벤트 타입 | 설명 | 주요 필드 |
|------------|------|-----------|
| `status` | 상태 전이 | `status` |
| `log` | 진행 로그 | `content` |
| `progress` | 진행률 | `step`, `total`, `content` |
| `tool_call` | 도구 호출 | `tool`, `detail` |
| `tool_output` | 도구 결과 | `tool`, `content` |
| `result` | 최종 결과 | `prUrl`, `prNumber` |
| `error` | 에러 | `message` |

---

## 클라이언트 Hook 구조

### 계층 구조

```
useSseStream (Core Hook — @repo/ui)
  ├── useStreamChat (Agent Desk — 채팅)
  ├── useExecutionStream (Agent Desk — 파이프라인 실행)
  └── useChatStream (Agent — 대화)
```

### Core Hook: `useSseStream`

**위치**: `packages/ui/src/hooks/use-sse-stream.ts`

제네릭 SSE 스트리밍 Hook. 모든 Feature-specific Hook의 기반.

```typescript
interface UseSseStreamOptions {
  url: string;
  getHeaders?: () => Record<string, string>;
}

interface SendOptions<TEvent> {
  body: unknown;
  onEvent: (event: TEvent) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

// 반환: { send, abort, isStreaming }
```

**규칙**:
- `TEvent` 제네릭으로 이벤트 타입 지정
- `AbortController`로 스트림 취소 지원
- `getHeaders()`로 인증 헤더 동적 주입
- AbortError는 정상 중단으로 처리 (에러 콜백 미호출)

---

### Feature Hook 패턴 1: 텍스트 누적 (useState)

**용도**: 단일 응답 스트리밍 (채팅 메시지 하나)

```typescript
// 핵심 상태
const [streamingContent, setStreamingContent] = useState("");

// 이벤트 처리
onEvent: (event) => {
  if (event.type === "chunk" && event.content) {
    setStreamingContent((prev) => prev + event.content);
  }
}

// 전송 시 초기화
const send = (params) => {
  setStreamingContent("");
  sseSend({ body: params, onEvent, onComplete });
};

// 반환: { send, abort, isStreaming, streamingContent }
```

---

### Feature Hook 패턴 2: 이벤트 배열 누적 (useState)

**용도**: 다중 이벤트 타입 처리 (파이프라인 실행)

```typescript
// 핵심 상태
const [events, setEvents] = useState<ExecutionEvent[]>([]);
const [latestLog, setLatestLog] = useState("");
const [result, setResult] = useState<ResultType | null>(null);
const [error, setError] = useState<string | null>(null);

// 이벤트 처리 — 항상 배열에 누적 + 타입별 분기
onEvent: (event) => {
  setEvents((prev) => [...prev, event]);

  if (event.type === "log") setLatestLog(event.content);
  if (event.type === "result") setResult({ ... });
  if (event.type === "error") setError(event.message);
  if (event.type === "status") invalidateQuery();
}

// 반환: { execute, abort, isExecuting, events, latestLog, result, error }
```

---

### Feature Hook 패턴 3: Jotai Atom 연동

**용도**: 전역 상태가 필요한 대화형 UI (멀티 스레드 채팅)

```typescript
// store/chat.atoms.ts
export const messagesAtom = atom<ChatMessage[]>([]);
export const currentThreadIdAtom = atom<string | null>(null);
export const isStreamingAtom = atom(false);

// Hook에서 atom 사용
const [messages, setMessages] = useAtom(messagesAtom);

// 낙관적 메시지 추가
const userMsg = { id: crypto.randomUUID(), role: "user", content: input };
setMessages((prev) => [...prev, userMsg]);

// 빈 Assistant 메시지 생성 → 스트리밍으로 채워감
const assistantId = crypto.randomUUID();
setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

// 스트리밍 이벤트 → 기존 메시지에 텍스트 append
onEvent: (data) => {
  if (data.text) {
    setMessages((prev) =>
      prev.map((m) => m.id === assistantId
        ? { ...m, content: m.content + data.text }
        : m
      )
    );
  }
}
```

---

## 패턴 선택 기준

| 상황 | 패턴 | 이유 |
|------|------|------|
| 단순 채팅 (단일 응답) | 패턴 1 (useState 텍스트 누적) | 상태가 단순, 컴포넌트 로컬로 충분 |
| 파이프라인/실행 로그 | 패턴 2 (useState 이벤트 배열) | 다중 이벤트 타입, 로컬 상태 |
| 멀티 스레드 채팅 | 패턴 3 (Jotai atom) | 여러 컴포넌트 간 상태 공유 필요 |

---

## UI 스트리밍 상태 표시

| 상태 | 표시 방법 |
|------|----------|
| `isStreaming: true` + content 있음 | 깜빡이는 커서 (`animate-pulse`) |
| `isStreaming: true` + content 없음 | 타이핑 dots (`TypingDotsInline`) |
| `isExecuting: true` | 스피너 + "실행 중..." 라벨 |
| 이벤트 누적 중 | 자동 스크롤 로그 뷰 |
| 에러 발생 | 에러 메시지 + 재시도 버튼 |
| 완료 | 결과 표시 (PR 링크 등) |

---

## 스트림 취소 & 정리

- **Escape 키**: 스트리밍 중 Escape 누르면 `abort()` 호출
- **컴포넌트 언마운트**: AbortController로 자동 정리
- **abort() 호출 시**: `streamingContent` / `events` 초기화

---

## 금지 사항

| 금지 | 대안 |
|------|------|
| Polling으로 스트리밍 대체 | SSE 사용 |
| 스트리밍 중 전체 메시지 배열 교체 | 기존 배열에 append / map 업데이트 |
| useSseStream을 직접 컴포넌트에서 사용 | Feature Hook으로 래핑하여 사용 |
| 스트리밍 상태를 props로 깊이 전달 | Jotai atom 또는 Context 사용 |
