---
description: AI Tool definition conventions — naming, registry, Zod parameters
globs: "apps/agent-server/src/tools/**/*.ts"
alwaysApply: false
---

# AI Tool Definition Rules

> Agent가 사용하는 AI Tool 정의, 등록, 네이밍 규칙

---

## 디렉토리 구조

```
apps/agent-server/src/tools/
├── tool-registry.ts            # 중앙 등록소
├── board.tools.ts              # board.* tools
├── community.tools.ts          # community.* tools
├── content-studio.tools.ts     # studio.*, content.*, topic.*, seo.* tools
├── file.tools.ts               # file.* tools
├── user.tools.ts               # user.* tools
├── image-generation.ts         # image.generate, image.edit
└── index.ts                    # re-export
```

---

## Tool 정의 패턴

```typescript
import { tool } from "ai";
import { z } from "zod";

export const boardTools = {
  "board.list": tool({
    description: "게시판 목록을 조회합니다.",
    parameters: z.object({
      limit: z.number().optional().default(10).describe("조회할 개수"),
    }),
    execute: async ({ limit }) => {
      return db.query.boardBoards.findMany({
        limit,
        orderBy: [desc(boardBoards.createdAt)],
        columns: { id: true, title: true, description: true },
      });
    },
  }),

  "board.postSearch": tool({
    description: "게시글을 키워드로 검색합니다.",
    parameters: z.object({
      keyword: z.string().describe("검색 키워드"),
      boardId: z.string().uuid().optional().describe("특정 게시판 ID"),
    }),
    execute: async ({ keyword, boardId }) => { ... },
  }),
};
```

---

## 네이밍 규칙

### Tool 이름

```
{module}.{action}

board.list
board.postSearch
studio.list
content.create
image.generate
user.profile
```

| 규칙 | 설명 |
|------|------|
| `{module}` | Feature 또는 도메인 이름 (소문자) |
| `{action}` | 동작 (camelCase) |
| 구분자 | `.` (dot) |

### Name Sanitization

AI SDK 일부 프로바이더는 `.`을 지원하지 않으므로 Tool Registry에서 자동 변환한다.

```
studio.list → studio_list (등록 시)
```

- 내부 정의: `{module}.{action}` (dot)
- AI SDK 전달: `{module}_{action}` (underscore)
- `tool-registry.ts`의 `toSafeName()`이 자동 처리

### 파일 이름

```
{module}.tools.ts        # 단일 모듈
{module}-{sub}.tools.ts  # 복합 모듈

board.tools.ts
content-studio.tools.ts
image-generation.ts
```

---

## Tool Registry

### 등록

```typescript
// tool-registry.ts
const ALL_TOOLS: Record<string, CoreTool> = {};

export function registerTools(tools: Record<string, CoreTool>) {
  for (const [name, t] of Object.entries(tools)) {
    ALL_TOOLS[toSafeName(name)] = t;
  }
}

// index.ts — 시작 시 등록
registerTools(boardTools);
registerTools(communityTools);
registerTools(contentStudioTools);
registerTools(fileTools);
registerTools(userTools);
registerTools(imageGenerationTools);
```

### 조회

```typescript
export function getToolsForAgent(enabledTools: string[]): Record<string, CoreTool> {
  // Agent의 enabledTools 목록에 해당하는 Tool만 반환
}

export function getAllToolNames(): string[] {
  return Object.keys(ALL_TOOLS);
}
```

### Agent와 Tool 연결

Agent DB 레코드의 `enabledTools` 필드 (string[])로 사용 가능한 Tool 목록을 관리한다.

```typescript
// DB: agentAgents.enabledTools = ["board_list", "board_postSearch", "content_create"]
const tools = getToolsForAgent(agent.enabledTools ?? []);
```

---

## Tool 작성 규칙

### parameters (Zod)

```typescript
parameters: z.object({
  // 필수 파라미터
  id: z.string().uuid().describe("대상 ID"),

  // 선택 파라미터 (default 제공)
  limit: z.number().optional().default(10).describe("조회 개수"),
  page: z.number().optional().default(1).describe("페이지 번호"),

  // 문자열 제약
  keyword: z.string().min(1).max(100).describe("검색어"),

  // enum
  status: z.enum(["draft", "published"]).describe("게시 상태"),
})
```

| 규칙 | 설명 |
|------|------|
| `.describe()` 필수 | 모든 파라미터에 한국어 설명 추가 — LLM이 참조 |
| 최소 제약 | 필요한 최소한의 validation만 적용 |
| optional + default | 선택 파라미터는 기본값 제공 |
| UUID 검증 | ID 필드에 `.uuid()` 적용 |

### description

```typescript
// ✅ 명확하고 간결한 설명 (한국어)
description: "게시판 목록을 조회합니다."
description: "키워드로 게시글을 검색합니다."
description: "새 콘텐츠를 생성합니다. 제목과 본문이 필요합니다."

// ❌ 모호하거나 너무 긴 설명
description: "boards"
description: "이 도구는 사용자가 게시판의 전체 목록을 조회할 수 있도록 해주는 기능으로..."
```

### execute

```typescript
execute: async (params) => {
  // 1. DB 조회/변경
  // 2. 필요한 필드만 선택 (columns)
  // 3. 결과를 직접 return (JSON 직렬화 가능한 값)
}
```

| 규칙 | 설명 |
|------|------|
| columns 선택 | 전체 레코드 반환 금지 — 필요한 필드만 |
| 에러 처리 | throw 시 AI SDK가 tool_error로 변환 |
| 부작용 명시 | 데이터 변경 Tool은 description에 명시 |
| 인증 정보 | `execute`의 params에 userId 등 포함 (context에서 주입) |

---

## Tool 분류

| 유형 | 설명 | 예시 |
|------|------|------|
| **Query Tool** | 데이터 조회만 | `board.list`, `file.search`, `user.profile` |
| **Mutation Tool** | 데이터 생성/수정/삭제 | `content.create`, `topic.update` |
| **External Tool** | 외부 API 호출 | `image.generate` (DALL-E), `image.edit` (Gemini) |

### Model Router와의 연동

Model Router는 Mutation Tool 포함 여부로 모델을 선택한다:
- Write Tool (create/update) 포함 → Claude (정확한 추론)
- Query Tool만 → GPT-4o Mini (빠른 응답) 가능

---

## 새 Tool 추가 절차

1. **파일 생성/확장**: `src/tools/{module}.tools.ts`
2. **Tool 정의**: `tool()` + Zod parameters + execute
3. **등록**: `src/tools/index.ts`에서 `registerTools()` 호출
4. **Agent 설정**: DB의 Agent `enabledTools`에 Tool 이름 추가

---

## 금지 사항

| 금지 | 대안 |
|------|------|
| `.describe()` 누락 | 모든 파라미터에 한국어 설명 필수 |
| 전체 레코드 반환 | `columns`로 필요한 필드만 선택 |
| Tool 내 인증 로직 | 라우트 레벨에서 인증 후 userId를 params로 전달 |
| Tool 이름에 underscore 직접 사용 | dot notation 사용 → Registry가 자동 변환 |
| Tool 파일에서 직접 등록 | `index.ts`에서 일괄 등록 |
