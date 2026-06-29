# AI Runtime Server

Product Builder 운영 오퍼레이터 챗의 SSE streaming 전용 서버.

## 구조

- Next.js App Router, Node.js runtime
- POST /api/chat/stream — Mastra Agent SSE streaming
- 포트: 3003 (개발), Vercel 배포 시 별도 프로젝트로 분리

## 책임

- streamToken 검증 (Domain Server가 발급)
- Mastra Character Agent 구성 (request 시점, snapshot 기반)
- Vercel AI Gateway streaming 또는 mock
- SSE chunk 전송
- client disconnect 시 LLM abort → interrupted 처리
- assistant message draft/final 저장 요청 (Domain Server tRPC 호출)
- usage 기록 (token usage, duration)
- project/user/character 단위 active stream cap

## 책임 아님

- Character 공식 설정 원본 저장 (Domain Server 책임)
- Actor enabled 상태 source of truth (Domain Server 책임)
- thread/message 원본 단독 소유 (Domain Server 책임)
- 결제/사용량 ledger source of truth (Domain Server 책임)

## 환경 변수

| 변수 | 설명 | 필수 |
|---|---|---|
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway API Key. Vercel 배포에서는 OIDC 토큰이 fallback으로 사용됨 | 로컬/비-Vercel 필수 |
| `AI_GATEWAY_MODEL` | Primary Gateway model id | 기본값: `openai/gpt-4o-mini` |
| `AI_GATEWAY_FALLBACK_MODELS` | Gateway fallback model ids (콤마 구분) | 기본값: `google/gemini-2.5-flash,anthropic/claude-3.5-haiku` |
| `DOMAIN_SERVER_URL` | Domain Server URL | 기본값: http://localhost:3002 |
| `ALLOWED_ORIGINS` | CORS 허용 Origin allowlist (콤마 구분) | 기본값: http://localhost:3000 |
| `AI_MOCK` | mock 모드 (true/false) | 개발/E2E 전용 |

## 개발 실행

```bash
# 실제 AI 호출
pnpm --filter ai-runtime dev

# E2E 테스트용 (실제 LLM 호출 없음)
AI_MOCK=true pnpm --filter ai-runtime dev
```

## 스트림 처리

### Request Flow

1. FE → Domain Server: `POST /api/operator-chat/chat-sessions`
   - user message 즉시 저장
   - streamToken 발급 (base64url, 1분 만료)
   - actorSnapshotData 반환
2. FE → AI Runtime: `POST /api/chat/stream`
   - body: { streamToken, userMessage, actorSnapshotData, threadMessages, characterName, characterId }
3. AI Runtime:
   - streamToken 검증 (exp 확인)
   - active stream cap 체크 (user/character 단위)
   - Mastra Agent 구성 (snapshot 기반 instructions)
   - `agent.stream(messages)` 실행
   - SSE chunk 전송
4. Stream 완료 후 AI Runtime → Domain Server:
   - `PUT /api/operator-chat/chat-sessions/assistant/upsert`
   - status: completed | failed | interrupted

### 실패 처리

- **client disconnect**: `req.signal` AbortController → 부분 응답을 `interrupted`로 저장
- **provider error**: catch 후 `failed`로 저장
- **stream token expired**: 401 응답
- **active stream cap 초과**: 429 응답

## 가드레일

- maxDuration: 60초 (Vercel 한도)
- Node.js runtime (SSE 긴 연결 격리)
- CORS: `ALLOWED_ORIGINS`에 명시된 origin만 요청 Origin과 일치할 때 반사 (기본: localhost:3000)
- active stream: user/character 단위 1개 동시 실행

## Mastra 통합

`@mastra/core/agent`의 `Agent` 클래스를 사용해 request 시점에 캐릭터별 agent를 구성한다:

```ts
new Agent({
  id: `character-${actorId}`,
  name: characterName,
  instructions: buildCharacterInstructions(snapshot, characterName),
  model: gateway("openai/gpt-4o-mini"),
  defaultOptions: {
    providerOptions: {
      gateway: {
        models: ["google/gemini-2.5-flash", "anthropic/claude-3.5-haiku"],
      },
    },
  },
  tools: buildLoreTools(projectId, characterId, authHeader),
});
```

AI SDK v6 Gateway model은 Mastra의 current path인 `agent.generate()` / `agent.stream()`으로 호출한다. `generateLegacy()` / `streamLegacy()`는 v3 model specification을 지원하지 않는다.

actor snapshot의 `modelProvider`/`modelName`은 레거시 호환 입력이다. 실제 모델 선택과 fallback chain은 AI Runtime의 `AI_GATEWAY_MODEL`, `AI_GATEWAY_FALLBACK_MODELS`가 소유한다.

### Tools (read-only)

- `readCharacterProfile`: 현재 캐릭터 공식 설정
- `readCharacterRelations`: 캐릭터 관계 정보
- `readWorldLore`: 세계관 목록

write tool은 정책상 금지 (공식 설정은 작가 승인 흐름으로만 변경).

## Vercel 배포

```bash
# Vercel 프로젝트 환경 변수 설정
vercel env add AI_GATEWAY_API_KEY
vercel env add DOMAIN_SERVER_URL
vercel env add ALLOWED_ORIGINS

# 배포
vercel --prod
```

Fluid Compute 활성화를 권장 (긴 SSE 연결 최적화).
