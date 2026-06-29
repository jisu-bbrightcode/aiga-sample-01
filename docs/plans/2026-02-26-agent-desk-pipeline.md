# Agent Desk Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Agent Desk 채팅에서 수집된 요구사항을 AI가 자동 분석하고, Claude Agent SDK로 Feature를 구현하여 PR을 생성하는 파이프라인 구축.

**Architecture:** AI 응답의 `[ANALYZE_REQUEST]` 마커를 프론트엔드가 감지하면 파이프라인이 시작된다. AnalyzerService가 LLM으로 요구사항을 구조화하고, ExecutorService가 Git Worktree에서 Claude Agent SDK를 실행하여 Feature를 구현한다. SSE로 실시간 진행 상황을 스트리밍한다.

**Tech Stack:** NestJS, Drizzle ORM, tRPC, `@anthropic-ai/claude-agent-sdk`, Git Worktree, SSE, React, TanStack Query

**Design Doc:** `docs/plans/2026-02-26-agent-desk-pipeline-design.md`

---

### Task 1: Install Claude Agent SDK

**Files:**
- Modify: `apps/server/package.json`

**Step 1: Install package**

Run:
```bash
pnpm add @anthropic-ai/claude-agent-sdk --filter server
```

**Step 2: Verify installation**

Run:
```bash
grep "claude-agent-sdk" apps/server/package.json
```
Expected: `"@anthropic-ai/claude-agent-sdk": "^X.X.X"` 존재

**Step 3: Commit**

```bash
git add apps/server/package.json pnpm-lock.yaml
git commit -m "chore(agent-desk): install @anthropic-ai/claude-agent-sdk"
```

---

### Task 2: DB Schema — 세션 컬럼 추가 + Executions 테이블 생성

**Files:**
- Modify: `packages/drizzle/src/schema/features/agent-desk/index.ts`

**Step 1: 스키마에 execution enum + 컬럼 + 테이블 추가**

`packages/drizzle/src/schema/features/agent-desk/index.ts`를 수정한다.

기존 import 줄에 `jsonb` 추가:
```typescript
import { integer, jsonb, pgEnum, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
```

기존 enums 섹션 맨 아래 (`agentDeskMessageRoleEnum` 뒤)에 추가:
```typescript
export const agentDeskExecutionStatusEnum = pgEnum("agent_desk_execution_status", [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
]);
```

기존 `agentDeskSessions` 테이블의 `prompt` 컬럼 뒤, `createdById` 컬럼 앞에 3개 컬럼 추가:
```typescript
export const agentDeskSessions = pgTable("agent_desk_sessions", {
  ...baseColumns(),
  type: agentDeskSessionTypeEnum("type").notNull(),
  status: agentDeskSessionStatusEnum("status").notNull().default("uploading"),
  title: varchar("title", { length: 200 }),
  prompt: text("prompt"),
  analysisResult: jsonb("analysis_result"),
  spec: text("spec"),
  errorMessage: text("error_message"),
  createdById: uuid("created_by_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
});
```

`agentDeskMessages` 테이블 뒤에 새 테이블 추가:
```typescript
export const agentDeskExecutions = pgTable("agent_desk_executions", {
  ...baseColumns(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => agentDeskSessions.id, { onDelete: "cascade" }),
  worktreePath: text("worktree_path"),
  branchName: varchar("branch_name", { length: 200 }),
  prUrl: text("pr_url"),
  prNumber: integer("pr_number"),
  status: agentDeskExecutionStatusEnum("status").notNull().default("pending"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  log: text("log"),
});
```

기존 Relations 섹션에서 `agentDeskSessionsRelations`에 executions 추가:
```typescript
export const agentDeskSessionsRelations = relations(agentDeskSessions, ({ one, many }) => ({
  createdBy: one(profiles, {
    fields: [agentDeskSessions.createdById],
    references: [profiles.id],
  }),
  files: many(agentDeskFiles),
  messages: many(agentDeskMessages),
  executions: many(agentDeskExecutions),
}));
```

`agentDeskMessagesRelations` 뒤에 새 relation 추가:
```typescript
export const agentDeskExecutionsRelations = relations(agentDeskExecutions, ({ one }) => ({
  session: one(agentDeskSessions, {
    fields: [agentDeskExecutions.sessionId],
    references: [agentDeskSessions.id],
  }),
}));
```

Type Exports 섹션 맨 아래에 추가:
```typescript
export type AgentDeskExecution = typeof agentDeskExecutions.$inferSelect;
export type NewAgentDeskExecution = typeof agentDeskExecutions.$inferInsert;
```

**Step 2: Migration 생성**

Run:
```bash
cd packages/drizzle && pnpm drizzle-kit generate
```
Expected: `drizzle/` 폴더에 새 migration 파일 생성

**Step 3: Migration 적용**

Run:
```bash
cd packages/drizzle && pnpm drizzle-kit push
```
Expected: 테이블/컬럼 추가 성공

**Step 4: TypeScript 빌드 확인**

Run:
```bash
cd packages/drizzle && pnpm tsc --noEmit
```
Expected: 에러 없음

**Step 5: Commit**

```bash
git add packages/drizzle/
git commit -m "feat(agent-desk): add executions table and analysis columns to sessions"
```

---

### Task 3: Types 업데이트

**Files:**
- Modify: `packages/features/agent-desk/types/index.ts`

**Step 1: 타입 추가**

기존 파일 끝에 추가:

```typescript
export type ExecutionStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface AnalysisFeature {
  name: string;
  description: string;
  priority: "high" | "medium" | "low";
  complexity: "simple" | "moderate" | "complex";
  existingFeatures: string[];
  gaps: string[];
}

export interface AnalysisResult {
  features: AnalysisFeature[];
  summary: string;
  recommendation: string;
}

export interface ExecutionEvent {
  type: "status" | "log" | "progress" | "result" | "error";
  status?: SessionStatus;
  content?: string;
  step?: string;
  total?: number;
  prUrl?: string;
  prNumber?: number;
  message?: string;
}
```

**Step 2: Commit**

```bash
git add packages/features/agent-desk/types/
git commit -m "feat(agent-desk): add pipeline types (AnalysisResult, ExecutionEvent)"
```

---

### Task 4: System Prompts 업데이트 — [ANALYZE_REQUEST] 마커

**Files:**
- Modify: `packages/features/agent-desk/prompts/index.ts`

**Step 1: CUSTOMER_SYSTEM_PROMPT에 마커 규칙 추가**

기존 `CUSTOMER_SYSTEM_PROMPT` 전체를 교체. `## 응답 규칙` 뒤에 `## 분석 트리거` 섹션 추가:

```typescript
export const CUSTOMER_SYSTEM_PROMPT = `당신은 Product Builder의 서비스 생성 도우미 에이전트입니다.

## 역할
- 사용자가 만들고 싶은 서비스를 이해하고 안내합니다.
- 업로드된 파일(기획서, 참고자료)을 분석하여 요구사항을 정리합니다.
- Atlas의 기존 기능으로 구현 가능한 부분과 추가 개발이 필요한 부분을 설명합니다.
- 충분한 정보가 모이면 분석 진행을 제안합니다.

## 대화 가이드
1. 먼저 인사하고, 어떤 서비스를 만들고 싶은지 질문합니다.
2. 파일이 업로드되면 내용을 확인하고 핵심 요구사항을 정리합니다.
3. 추가 질문으로 서비스의 대상, 핵심 기능, 우선순위를 파악합니다.
4. 충분한 정보가 모이면 분석을 제안합니다.

## 응답 규칙
- 한국어로 응답합니다.
- 간결하고 명확하게 응답합니다.
- 한 번에 하나의 질문만 합니다.
- 기술 용어보다 비즈니스 용어를 사용합니다.

## 분석 트리거
충분한 정보가 모여서 분석을 시작할 준비가 되었다고 판단되면, 사용자에게 분석 여부를 물어봅니다.
사용자가 분석에 동의하면, 응답 마지막에 반드시 다음 마커를 포함합니다:
[ANALYZE_REQUEST]
이 마커는 시스템이 자동으로 감지합니다. 사용자에게는 마커가 보이지 않으며, 마커 앞에 요구사항 요약을 포함합니다.`;
```

**Step 2: OPERATOR_SYSTEM_PROMPT에도 동일 패턴 추가**

```typescript
export const OPERATOR_SYSTEM_PROMPT = `당신은 Product Builder의 Feature 개발 분석 에이전트입니다.

## 역할
- 운영자가 추가하려는 기능의 요구사항을 분석합니다.
- 기존 Product Builder features와 비교하여 없는 기능(gap)을 식별합니다.
- 각 미구현 기능의 복잡도와 구현 방향을 제안합니다.
- 충분한 정보가 모이면 Gap 분석 진행을 제안합니다.

## 대화 가이드
1. 어떤 기능이 필요한지 파악합니다.
2. 파일이 업로드되면 기술적 관점에서 분석합니다.
3. 기존 features와의 관계를 설명합니다.
4. 준비되면 분석을 제안합니다.

## 응답 규칙
- 한국어로 응답합니다.
- 기술적이고 간결하게 대화합니다.
- Product Builder 코드베이스 구조를 이해하고 있다고 전제합니다.
- 구현 난이도와 의존성을 함께 안내합니다.

## 분석 트리거
충분한 정보가 모여서 분석을 시작할 준비가 되었다고 판단되면, 사용자에게 분석 여부를 물어봅니다.
사용자가 분석에 동의하면, 응답 마지막에 반드시 다음 마커를 포함합니다:
[ANALYZE_REQUEST]
이 마커는 시스템이 자동으로 감지합니다. 사용자에게는 마커가 보이지 않으며, 마커 앞에 요구사항 요약을 포함합니다.`;
```

**Step 3: 테스트 실행**

Run:
```bash
cd packages/features/agent-desk && npx jest service/chat.service.spec.ts --passWithNoTests
```
Expected: 모든 테스트 통과 (mock이 실제 값을 대체하므로 영향 없음)

**Step 4: Commit**

```bash
git add packages/features/agent-desk/prompts/
git commit -m "feat(agent-desk): add [ANALYZE_REQUEST] marker to system prompts"
```

---

### Task 5: AnalyzerService 구현

**Files:**
- Create: `packages/features/agent-desk/service/analyzer.service.ts`
- Create: `packages/features/agent-desk/service/analyzer.service.spec.ts`
- Modify: `packages/features/agent-desk/service/index.ts`

**Step 1: AnalyzerService 작성**

Create `packages/features/agent-desk/service/analyzer.service.ts`:

```typescript
import { Injectable, BadRequestException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { InjectDrizzle, type DrizzleDB } from "@repo/drizzle";
import { agentDeskSessions, agentDeskFiles, agentDeskMessages } from "@repo/drizzle";
import { LLMService } from "@repo/features/ai";
import { createLogger } from "@repo/core/logger";
import type { AnalysisResult, ChatMessage } from "../types";

const logger = createLogger("agent-desk");

const ANALYSIS_SYSTEM_PROMPT = `당신은 소프트웨어 Feature 분석 전문가입니다.

## 입력
사용자와 에이전트의 대화 이력과 업로드된 파일 내용이 주어집니다.

## 출력
다음 JSON 형식으로 분석 결과를 출력하세요. JSON만 출력하고 다른 텍스트는 포함하지 마세요.

{
  "features": [
    {
      "name": "Feature 이름 (영문 kebab-case, 예: online-booking)",
      "description": "Feature 설명 (한국어)",
      "priority": "high | medium | low",
      "complexity": "simple | moderate | complex",
      "existingFeatures": ["재활용 가능한 기존 Feature명"],
      "gaps": ["추가 구현이 필요한 항목"]
    }
  ],
  "summary": "전체 분석 요약 (한국어)",
  "recommendation": "권장 구현 순서 (한국어)"
}

## 규칙
- 각 Feature는 독립적으로 구현 가능한 단위로 분리합니다.
- 기존 Product Builder Feature(auth, blog, payment, booking, community 등)와 겹치는 부분을 식별합니다.
- priority는 비즈니스 중요도, complexity는 기술적 난이도 기준입니다.
- 반드시 유효한 JSON만 출력합니다.`;

const SPEC_SYSTEM_PROMPT = `당신은 Product Builder의 Feature 구현 스펙 작성 전문가입니다.

## 입력
Feature 분석 결과(JSON)가 주어집니다.

## 출력
Claude Code가 실행할 수 있는 구현 프롬프트를 작성하세요.

## 규칙
- Product Builder의 feature 개발 규칙을 따릅니다:
  1. Schema 정의 (packages/drizzle/src/schema/features/{name}/index.ts)
  2. Types 정의
  3. DTO + Validation (Zod)
  4. Service 구현 + 로깅
  5. tRPC Router
  6. REST Controller + Swagger
  7. NestJS Module
  8. 등록 (schema index, app.module, app-router, trpc router)
- 각 Feature별로 구현 순서와 구체적인 코드 지침을 포함합니다.
- 기존 Feature를 절대 수정하지 않습니다.
- 파일 경로를 정확히 명시합니다.`;

@Injectable()
export class AnalyzerService {
  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly llmService: LLMService,
  ) {}

  async analyze(sessionId: string): Promise<AnalysisResult> {
    const session = await this.db.query.agentDeskSessions.findFirst({
      where: eq(agentDeskSessions.id, sessionId),
    });
    if (!session) throw new BadRequestException(`Session not found: ${sessionId}`);

    const messages = await this.db.query.agentDeskMessages.findMany({
      where: eq(agentDeskMessages.sessionId, sessionId),
    });
    const history = messages.map((m) => `[${m.role}]: ${m.content}`).join("\n\n");

    const files = await this.db.query.agentDeskFiles.findMany({
      where: eq(agentDeskFiles.sessionId, sessionId),
    });
    const fileContext = files
      .filter((f) => f.parsedContent)
      .map((f) => `--- ${f.originalName} ---\n${f.parsedContent}`)
      .join("\n\n");

    const chatMessages: ChatMessage[] = [
      { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
    ];
    if (fileContext) {
      chatMessages.push({ role: "system", content: `업로드된 파일 내용:\n${fileContext}` });
    }
    chatMessages.push({ role: "user", content: `다음 대화를 분석하여 Feature를 도출하세요:\n\n${history}` });

    const rawResult = await this.llmService.chatCompletion(chatMessages);

    let analysisResult: AnalysisResult;
    try {
      const jsonMatch = rawResult.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in response");
      analysisResult = JSON.parse(jsonMatch[0]);
    } catch {
      logger.error("Analysis result parsing failed", {
        "agent_desk.session_id": sessionId,
        "error.message": "Failed to parse LLM response as JSON",
      });
      throw new BadRequestException("분석 결과를 파싱할 수 없습니다.");
    }

    await this.db
      .update(agentDeskSessions)
      .set({ analysisResult, status: "analyzed" })
      .where(eq(agentDeskSessions.id, sessionId));

    logger.info("Analysis completed", {
      "agent_desk.session_id": sessionId,
      "agent_desk.feature_count": analysisResult.features.length,
    });

    return analysisResult;
  }

  async generateSpec(sessionId: string): Promise<string> {
    const session = await this.db.query.agentDeskSessions.findFirst({
      where: eq(agentDeskSessions.id, sessionId),
    });
    if (!session) throw new BadRequestException(`Session not found: ${sessionId}`);
    if (!session.analysisResult) throw new BadRequestException("분석 결과가 없습니다. 먼저 분석을 실행하세요.");

    const chatMessages: ChatMessage[] = [
      { role: "system", content: SPEC_SYSTEM_PROMPT },
      {
        role: "user",
        content: `다음 분석 결과를 기반으로 구현 스펙을 작성하세요:\n\n${JSON.stringify(session.analysisResult, null, 2)}`,
      },
    ];

    const spec = await this.llmService.chatCompletion(chatMessages);

    await this.db
      .update(agentDeskSessions)
      .set({ spec, status: "spec_generated" })
      .where(eq(agentDeskSessions.id, sessionId));

    logger.info("Spec generated", {
      "agent_desk.session_id": sessionId,
      "agent_desk.spec_length": spec.length,
    });

    return spec;
  }
}
```

**Step 2: service/index.ts에 export 추가**

`packages/features/agent-desk/service/index.ts`에 줄 추가:
```typescript
export { AnalyzerService } from "./analyzer.service";
```

**Step 3: AnalyzerService 테스트 작성**

Create `packages/features/agent-desk/service/analyzer.service.spec.ts`:

```typescript
import { BadRequestException } from "@nestjs/common";
import { AnalyzerService } from "./analyzer.service";

jest.mock("drizzle-orm", () => ({
  eq: jest.fn((field: any, value: any) => ({ field, value, type: "eq" })),
}));

jest.mock("@repo/drizzle", () => ({
  DRIZZLE: "DRIZZLE_TOKEN",
  InjectDrizzle: () => () => undefined,
  agentDeskSessions: { id: { name: "id" } },
  agentDeskFiles: { sessionId: { name: "session_id" } },
  agentDeskMessages: { sessionId: { name: "session_id" } },
}));

jest.mock("@repo/core/logger", () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

jest.mock("@repo/features/ai", () => ({
  LLMService: jest.fn(),
}));

const mockSession = {
  id: "session-1",
  type: "customer",
  status: "analyzing",
  analysisResult: null,
};

const mockAnalysisJson = JSON.stringify({
  features: [
    {
      name: "online-booking",
      description: "온라인 예약 시스템",
      priority: "high",
      complexity: "moderate",
      existingFeatures: ["booking"],
      gaps: ["시간대별 슬롯 관리"],
    },
  ],
  summary: "예약 시스템 구현 필요",
  recommendation: "booking feature 확장",
});

describe("AnalyzerService", () => {
  let service: AnalyzerService;
  let mockDb: any;
  let mockLLMService: any;

  beforeEach(() => {
    mockDb = {
      query: {
        agentDeskSessions: { findFirst: jest.fn() },
        agentDeskMessages: { findMany: jest.fn() },
        agentDeskFiles: { findMany: jest.fn() },
      },
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue(undefined),
    };
    mockLLMService = {
      chatCompletion: jest.fn(),
    };
    service = new AnalyzerService(mockDb, mockLLMService);
  });

  describe("analyze", () => {
    it("should analyze session and return structured result", async () => {
      mockDb.query.agentDeskSessions.findFirst.mockResolvedValue(mockSession);
      mockDb.query.agentDeskMessages.findMany.mockResolvedValue([
        { role: "user", content: "예약 시스템 만들어주세요" },
      ]);
      mockDb.query.agentDeskFiles.findMany.mockResolvedValue([]);
      mockLLMService.chatCompletion.mockResolvedValue(mockAnalysisJson);

      const result = await service.analyze("session-1");

      expect(result.features).toHaveLength(1);
      expect(result.features[0].name).toBe("online-booking");
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("should throw when session not found", async () => {
      mockDb.query.agentDeskSessions.findFirst.mockResolvedValue(null);

      await expect(service.analyze("nonexistent")).rejects.toThrow(BadRequestException);
    });

    it("should throw when LLM returns invalid JSON", async () => {
      mockDb.query.agentDeskSessions.findFirst.mockResolvedValue(mockSession);
      mockDb.query.agentDeskMessages.findMany.mockResolvedValue([]);
      mockDb.query.agentDeskFiles.findMany.mockResolvedValue([]);
      mockLLMService.chatCompletion.mockResolvedValue("invalid response");

      await expect(service.analyze("session-1")).rejects.toThrow(BadRequestException);
    });
  });

  describe("generateSpec", () => {
    it("should generate spec from analysis result", async () => {
      const sessionWithAnalysis = {
        ...mockSession,
        analysisResult: JSON.parse(mockAnalysisJson),
      };
      mockDb.query.agentDeskSessions.findFirst.mockResolvedValue(sessionWithAnalysis);
      mockLLMService.chatCompletion.mockResolvedValue("Implementation spec...");

      const result = await service.generateSpec("session-1");

      expect(result).toBe("Implementation spec...");
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("should throw when no analysis result exists", async () => {
      mockDb.query.agentDeskSessions.findFirst.mockResolvedValue(mockSession);

      await expect(service.generateSpec("session-1")).rejects.toThrow(BadRequestException);
    });
  });
});
```

**Step 4: 테스트 실행**

Run:
```bash
cd packages/features/agent-desk && npx jest service/analyzer.service.spec.ts --passWithNoTests
```
Expected: 모든 테스트 통과

**Step 5: Commit**

```bash
git add packages/features/agent-desk/service/analyzer.service.ts packages/features/agent-desk/service/analyzer.service.spec.ts packages/features/agent-desk/service/index.ts
git commit -m "feat(agent-desk): implement AnalyzerService with LLM analysis and spec generation"
```

---

### Task 6: ExecutorService 구현

**Files:**
- Create: `packages/features/agent-desk/service/executor.service.ts`
- Create: `packages/features/agent-desk/service/executor.service.spec.ts`
- Modify: `packages/features/agent-desk/service/index.ts`

**Step 1: ExecutorService 작성**

Create `packages/features/agent-desk/service/executor.service.ts`:

> **보안 참고**: Git 명령어는 `execFileSync`를 사용하여 shell injection을 방지한다. 모든 인자는 배열로 전달한다.

```typescript
import { Injectable, BadRequestException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { InjectDrizzle, type DrizzleDB } from "@repo/drizzle";
import { agentDeskSessions, agentDeskExecutions } from "@repo/drizzle";
import { createLogger } from "@repo/core/logger";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { ExecutionEvent } from "../types";

const logger = createLogger("agent-desk");

const MAX_CONCURRENT = parseInt(process.env.AGENT_DESK_MAX_CONCURRENT ?? "3", 10);
const WORKTREE_BASE = process.env.AGENT_DESK_WORKTREE_BASE ?? join(process.cwd(), ".agent-worktrees");

interface RunningExecution {
  worktreePath: string;
  abortController: AbortController;
  status: "running" | "completed" | "failed" | "cancelled";
}

@Injectable()
export class ExecutorService {
  private readonly running = new Map<string, RunningExecution>();

  constructor(@InjectDrizzle() private readonly db: DrizzleDB) {}

  getRunningCount(): number {
    return this.running.size;
  }

  isRunning(sessionId: string): boolean {
    return this.running.has(sessionId);
  }

  async execute(
    sessionId: string,
    onEvent: (event: ExecutionEvent) => void,
  ): Promise<void> {
    if (this.running.size >= MAX_CONCURRENT) {
      throw new BadRequestException(
        `현재 실행 중인 작업이 ${MAX_CONCURRENT}개입니다. 잠시 후 다시 시도해주세요.`,
      );
    }

    if (this.running.has(sessionId)) {
      throw new BadRequestException("이 세션은 이미 실행 중입니다.");
    }

    const session = await this.db.query.agentDeskSessions.findFirst({
      where: eq(agentDeskSessions.id, sessionId),
    });
    if (!session) throw new BadRequestException(`Session not found: ${sessionId}`);
    if (!session.spec) throw new BadRequestException("스펙이 없습니다. 먼저 스펙을 생성하세요.");

    const abortController = new AbortController();
    const branchName = `feat/agent-desk-${sessionId.slice(0, 8)}`;
    const worktreePath = join(WORKTREE_BASE, branchName);

    const [execution] = await this.db
      .insert(agentDeskExecutions)
      .values({
        sessionId,
        worktreePath,
        branchName,
        status: "running",
        startedAt: new Date(),
      })
      .returning();

    this.running.set(sessionId, { worktreePath, abortController, status: "running" });

    await this.db
      .update(agentDeskSessions)
      .set({ status: "executing" })
      .where(eq(agentDeskSessions.id, sessionId));

    onEvent({ type: "status", status: "executing" });

    try {
      // 1. Worktree 생성
      onEvent({ type: "log", content: "Git worktree 생성 중..." });
      this.createWorktree(worktreePath, branchName);
      onEvent({ type: "log", content: `Worktree 생성 완료: ${branchName}` });

      // 2. Claude Agent SDK 실행
      onEvent({ type: "log", content: "Claude Code 실행 중..." });
      const { query } = await import("@anthropic-ai/claude-agent-sdk");

      let logBuffer = "";
      for await (const message of query({
        prompt: session.spec,
        options: {
          cwd: worktreePath,
          abortController,
          permissionMode: "acceptEdits",
          allowedTools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
          maxTurns: 100,
          systemPrompt: {
            type: "preset",
            preset: "claude_code",
            append: `\n\n이 프로젝트는 Product Builder입니다. .claude/rules/ 디렉토리의 규칙을 반드시 따르세요.\n기존 Feature를 절대 수정하지 마세요.`,
          },
        },
      })) {
        if (abortController.signal.aborted) break;

        if (message.type === "assistant" && message.message?.content) {
          for (const block of message.message.content) {
            if ("text" in block) {
              logBuffer += block.text + "\n";
              onEvent({ type: "log", content: block.text });
            } else if ("name" in block) {
              onEvent({ type: "progress", step: `Tool: ${block.name}`, total: 0 });
            }
          }
        } else if (message.type === "result") {
          if (message.subtype === "success") {
            onEvent({ type: "log", content: "Claude Code 실행 완료" });
          } else {
            throw new Error(`Claude Code 실행 실패: ${message.subtype}`);
          }
        }
      }

      // 3. 빌드 검증
      onEvent({ type: "log", content: "TypeScript 빌드 검증 중..." });
      try {
        execFileSync("pnpm", ["tsc", "--noEmit"], { cwd: worktreePath, timeout: 120_000 });
        onEvent({ type: "log", content: "빌드 검증 통과" });
      } catch (buildError) {
        onEvent({ type: "log", content: "빌드 실패 — 자동 수정 시도 중..." });

        const errorOutput = buildError instanceof Error ? buildError.message : String(buildError);
        for await (const message of query({
          prompt: `TypeScript 빌드 에러가 발생했습니다. 수정해주세요:\n\n${errorOutput}`,
          options: {
            cwd: worktreePath,
            permissionMode: "acceptEdits",
            allowedTools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
            maxTurns: 20,
          },
        })) {
          if (message.type === "assistant" && message.message?.content) {
            for (const block of message.message.content) {
              if ("text" in block) onEvent({ type: "log", content: block.text });
            }
          }
        }

        execFileSync("pnpm", ["tsc", "--noEmit"], { cwd: worktreePath, timeout: 120_000 });
        onEvent({ type: "log", content: "자동 수정 후 빌드 검증 통과" });
      }

      // 4. Git commit + push + PR 생성
      onEvent({ type: "log", content: "변경사항 커밋 및 PR 생성 중..." });
      execFileSync("git", ["add", "-A"], { cwd: worktreePath, timeout: 30_000 });
      execFileSync("git", ["commit", "-m", "feat: agent-desk auto-generated feature", "--allow-empty"], {
        cwd: worktreePath,
        timeout: 30_000,
      });
      execFileSync("git", ["push", "-u", "origin", branchName], {
        cwd: worktreePath,
        timeout: 60_000,
      });

      const prOutput = execFileSync(
        "gh",
        ["pr", "create", "--title", "feat: Agent Desk auto-generated feature", "--body", "Agent Desk 파이프라인이 자동 생성한 PR입니다.", "--base", "develop"],
        { cwd: worktreePath, timeout: 30_000 },
      ).toString().trim();

      const prUrl = prOutput;
      const prNumberMatch = prUrl.match(/\/pull\/(\d+)/);
      const prNumber = prNumberMatch ? parseInt(prNumberMatch[1], 10) : null;

      // 5. DB 업데이트 — 성공
      await this.db
        .update(agentDeskExecutions)
        .set({ status: "completed", completedAt: new Date(), prUrl, prNumber, log: logBuffer })
        .where(eq(agentDeskExecutions.id, execution.id));

      await this.db
        .update(agentDeskSessions)
        .set({ status: "executed" })
        .where(eq(agentDeskSessions.id, sessionId));

      onEvent({ type: "result", prUrl, prNumber: prNumber ?? undefined });
      onEvent({ type: "status", status: "executed" });

      logger.info("Execution completed", {
        "agent_desk.session_id": sessionId,
        "agent_desk.pr_url": prUrl,
        "agent_desk.branch": branchName,
      });

      // 6. Worktree 정리
      this.cleanupWorktree(worktreePath, branchName);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);

      await this.db
        .update(agentDeskExecutions)
        .set({ status: "failed", completedAt: new Date(), log: errMsg })
        .where(eq(agentDeskExecutions.id, execution.id));

      await this.db
        .update(agentDeskSessions)
        .set({ status: "failed", errorMessage: errMsg })
        .where(eq(agentDeskSessions.id, sessionId));

      onEvent({ type: "error", message: errMsg });
      onEvent({ type: "status", status: "failed" });

      logger.error("Execution failed", {
        "agent_desk.session_id": sessionId,
        "error.message": errMsg,
      });
    } finally {
      this.running.delete(sessionId);
    }
  }

  async cancel(sessionId: string): Promise<void> {
    const entry = this.running.get(sessionId);
    if (!entry) throw new BadRequestException("실행 중인 작업이 없습니다.");
    entry.abortController.abort();
    this.running.delete(sessionId);

    await this.db
      .update(agentDeskSessions)
      .set({ status: "failed", errorMessage: "사용자에 의해 취소됨" })
      .where(eq(agentDeskSessions.id, sessionId));

    logger.info("Execution cancelled", { "agent_desk.session_id": sessionId });
  }

  private createWorktree(worktreePath: string, branchName: string): void {
    if (!existsSync(WORKTREE_BASE)) {
      mkdirSync(WORKTREE_BASE, { recursive: true });
    }
    const projectRoot = process.cwd();
    execFileSync("git", ["worktree", "add", worktreePath, "-b", branchName, "develop"], {
      cwd: projectRoot,
      timeout: 30_000,
    });
  }

  private cleanupWorktree(worktreePath: string, branchName: string): void {
    try {
      const projectRoot = process.cwd();
      execFileSync("git", ["worktree", "remove", worktreePath, "--force"], {
        cwd: projectRoot,
        timeout: 15_000,
      });
      execFileSync("git", ["branch", "-D", branchName], {
        cwd: projectRoot,
        timeout: 10_000,
      });
    } catch (error) {
      logger.warn("Worktree cleanup failed", {
        "agent_desk.worktree_path": worktreePath,
        "error.message": error instanceof Error ? error.message : String(error),
      });
    }
  }
}
```

**Step 2: service/index.ts에 export 추가**

`packages/features/agent-desk/service/index.ts`에 줄 추가:
```typescript
export { ExecutorService } from "./executor.service";
```

**Step 3: ExecutorService 테스트 작성**

Create `packages/features/agent-desk/service/executor.service.spec.ts`:

```typescript
import { BadRequestException } from "@nestjs/common";
import { ExecutorService } from "./executor.service";

jest.mock("drizzle-orm", () => ({
  eq: jest.fn((field: any, value: any) => ({ field, value, type: "eq" })),
}));

jest.mock("@repo/drizzle", () => ({
  DRIZZLE: "DRIZZLE_TOKEN",
  InjectDrizzle: () => () => undefined,
  agentDeskSessions: { id: { name: "id" } },
  agentDeskExecutions: { id: { name: "id" } },
}));

jest.mock("@repo/core/logger", () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe("ExecutorService", () => {
  let service: ExecutorService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      query: {
        agentDeskSessions: { findFirst: jest.fn() },
      },
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([{ id: "exec-1" }]),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue(undefined),
    };
    service = new ExecutorService(mockDb);
  });

  describe("getRunningCount", () => {
    it("should return 0 when no executions running", () => {
      expect(service.getRunningCount()).toBe(0);
    });
  });

  describe("isRunning", () => {
    it("should return false for non-running session", () => {
      expect(service.isRunning("session-1")).toBe(false);
    });
  });

  describe("execute", () => {
    it("should throw when session not found", async () => {
      mockDb.query.agentDeskSessions.findFirst.mockResolvedValue(null);

      await expect(
        service.execute("nonexistent", jest.fn()),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw when spec is missing", async () => {
      mockDb.query.agentDeskSessions.findFirst.mockResolvedValue({
        id: "session-1",
        spec: null,
      });

      await expect(
        service.execute("session-1", jest.fn()),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("cancel", () => {
    it("should throw when no execution running", async () => {
      await expect(service.cancel("session-1")).rejects.toThrow(BadRequestException);
    });
  });
});
```

**Step 4: 테스트 실행**

Run:
```bash
cd packages/features/agent-desk && npx jest service/executor.service.spec.ts --passWithNoTests
```
Expected: 모든 테스트 통과

**Step 5: Commit**

```bash
git add packages/features/agent-desk/service/executor.service.ts packages/features/agent-desk/service/executor.service.spec.ts packages/features/agent-desk/service/index.ts
git commit -m "feat(agent-desk): implement ExecutorService with Claude Agent SDK and git worktree"
```

---

### Task 7: DTOs 추가

**Files:**
- Create: `packages/features/agent-desk/dto/analyze.dto.ts`
- Create: `packages/features/agent-desk/dto/execute.dto.ts`

**Step 1: analyze DTO 작성**

Create `packages/features/agent-desk/dto/analyze.dto.ts`:

```typescript
import { z } from "zod";

export const analyzeSchema = z.object({
  sessionId: z.string().uuid().describe("분석할 세션 ID"),
});

export type AnalyzeDto = z.infer<typeof analyzeSchema>;
```

**Step 2: execute DTO 작성**

Create `packages/features/agent-desk/dto/execute.dto.ts`:

```typescript
import { z } from "zod";

export const executeSchema = z.object({
  sessionId: z.string().uuid().describe("실행할 세션 ID"),
});

export const cancelExecutionSchema = z.object({
  sessionId: z.string().uuid().describe("취소할 세션 ID"),
});

export type ExecuteDto = z.infer<typeof executeSchema>;
export type CancelExecutionDto = z.infer<typeof cancelExecutionSchema>;
```

**Step 3: Commit**

```bash
git add packages/features/agent-desk/dto/analyze.dto.ts packages/features/agent-desk/dto/execute.dto.ts
git commit -m "feat(agent-desk): add analyze and execute DTOs"
```

---

### Task 8: tRPC Router 확장

**Files:**
- Modify: `packages/features/agent-desk/trpc/agent-desk.route.ts`

**Step 1: import 추가 (파일 상단)**

```typescript
import type { AnalyzerService } from "../service/analyzer.service";
import type { ExecutorService } from "../service/executor.service";
import { analyzeSchema } from "../dto/analyze.dto";
import { executeSchema, cancelExecutionSchema } from "../dto/execute.dto";
```

**Step 2: createServiceContainer 타입 확장**

기존:
```typescript
const services = createServiceContainer<{
  sessionService: SessionService;
  fileParserService: FileParserService;
  chatService: ChatService;
}>();
```

변경:
```typescript
const services = createServiceContainer<{
  sessionService: SessionService;
  fileParserService: FileParserService;
  chatService: ChatService;
  analyzerService: AnalyzerService;
  executorService: ExecutorService;
}>();
```

**Step 3: getMessages 프로시저 뒤에 Pipeline 프로시저 추가**

```typescript
  // ========================================
  // Pipeline
  // ========================================

  /** 세션 분석 */
  analyze: authProcedure
    .input(analyzeSchema)
    .mutation(async ({ input }) => {
      const { analyzerService, sessionService } = services.get();
      await sessionService.updateStatus(input.sessionId, "analyzing");
      return analyzerService.analyze(input.sessionId);
    }),

  /** 스펙 생성 + 실행 시작 */
  execute: authProcedure
    .input(executeSchema)
    .mutation(async ({ input }) => {
      const { analyzerService, sessionService } = services.get();
      const session = await sessionService.findById(input.sessionId);
      if (!session.spec) {
        await analyzerService.generateSpec(input.sessionId);
      }
      return { started: true, sessionId: input.sessionId };
    }),

  /** 실행 취소 */
  cancelExecution: authProcedure
    .input(cancelExecutionSchema)
    .mutation(async ({ input }) => {
      await services.get().executorService.cancel(input.sessionId);
      return { cancelled: true };
    }),

  /** 실행 상태 조회 */
  getExecution: authProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .query(async ({ input }) => {
      const { executorService } = services.get();
      return {
        isRunning: executorService.isRunning(input.sessionId),
        runningCount: executorService.getRunningCount(),
      };
    }),
```

**Step 4: Commit**

```bash
git add packages/features/agent-desk/trpc/
git commit -m "feat(agent-desk): add pipeline tRPC procedures (analyze, execute, cancel)"
```

---

### Task 9: REST Controller 확장

**Files:**
- Modify: `packages/features/agent-desk/controller/agent-desk.controller.ts`

**Step 1: import 추가**

```typescript
import { AnalyzerService } from "../service/analyzer.service";
import { ExecutorService } from "../service/executor.service";
import type { AnalyzeDto } from "../dto/analyze.dto";
import type { ExecuteDto, CancelExecutionDto } from "../dto/execute.dto";
```

**Step 2: constructor 확장**

```typescript
constructor(
  private readonly sessionService: SessionService,
  private readonly fileParserService: FileParserService,
  private readonly chatService: ChatService,
  private readonly analyzerService: AnalyzerService,
  private readonly executorService: ExecutorService,
) {}
```

**Step 3: getMessages 뒤에 Pipeline 엔드포인트 추가**

```typescript
  // ============================================================================
  // Pipeline Endpoints
  // ============================================================================

  /** POST /api/agent-desk/pipeline/analyze */
  @Post("pipeline/analyze")
  @ApiOperation({ summary: "세션 요구사항 분석" })
  @ApiResponse({ status: 200, description: "분석 결과 반환" })
  @ApiResponse({ status: 400, description: "분석 실패" })
  async analyze(@Body() dto: AnalyzeDto) {
    await this.sessionService.updateStatus(dto.sessionId, "analyzing");
    return this.analyzerService.analyze(dto.sessionId);
  }

  /** POST /api/agent-desk/pipeline/execute (SSE) */
  @Post("pipeline/execute")
  @ApiOperation({ summary: "Feature 구현 실행 (SSE 스트리밍)" })
  @ApiResponse({ status: 200, description: "SSE 스트리밍 응답" })
  async executeStream(@Body() dto: ExecuteDto, @Res() reply: FastifyReply) {
    const origin = (reply.request.headers as Record<string, string>).origin ?? "*";
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
    });

    try {
      const session = await this.sessionService.findById(dto.sessionId);
      if (!session.spec) {
        reply.raw.write(`data: ${JSON.stringify({ type: "log", content: "스펙 생성 중..." })}\n\n`);
        await this.analyzerService.generateSpec(dto.sessionId);
        reply.raw.write(`data: ${JSON.stringify({ type: "log", content: "스펙 생성 완료" })}\n\n`);
        reply.raw.write(`data: ${JSON.stringify({ type: "status", status: "spec_generated" })}\n\n`);
      }

      await this.executorService.execute(dto.sessionId, (event) => {
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      reply.raw.write(`data: ${JSON.stringify({ type: "error", message: errMsg })}\n\n`);
      logger.error("Pipeline execution failed", {
        "agent_desk.session_id": dto.sessionId,
        "error.message": errMsg,
      });
    }

    reply.raw.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
    reply.raw.end();
  }

  /** POST /api/agent-desk/pipeline/cancel */
  @Post("pipeline/cancel")
  @ApiOperation({ summary: "실행 취소" })
  @ApiResponse({ status: 200, description: "취소 성공" })
  async cancelExecution(@Body() dto: CancelExecutionDto) {
    await this.executorService.cancel(dto.sessionId);
    return { cancelled: true };
  }

  /** GET /api/agent-desk/pipeline/status/:sessionId */
  @Get("pipeline/status/:sessionId")
  @ApiOperation({ summary: "실행 상태 조회" })
  @ApiParam({ name: "sessionId", description: "세션 UUID" })
  @ApiResponse({ status: 200, description: "실행 상태 반환" })
  async getExecutionStatus(@Param("sessionId", ParseUUIDPipe) sessionId: string) {
    return {
      isRunning: this.executorService.isRunning(sessionId),
      runningCount: this.executorService.getRunningCount(),
    };
  }
```

**Step 4: Commit**

```bash
git add packages/features/agent-desk/controller/
git commit -m "feat(agent-desk): add pipeline REST endpoints with SSE streaming"
```

---

### Task 10: NestJS Module 업데이트

**Files:**
- Modify: `packages/features/agent-desk/agent-desk.module.ts`
- Modify: `packages/features/agent-desk/index.ts`

**Step 1: Module에 새 서비스 등록**

`packages/features/agent-desk/agent-desk.module.ts` 전체 교체:

```typescript
import { Module, OnModuleInit } from "@nestjs/common";
import { AIModule } from "@repo/features/ai";
import { SessionService, FileParserService, ChatService, AnalyzerService, ExecutorService } from "./service";
import { AgentDeskController } from "./controller";
import { injectAgentDeskServices } from "./trpc";

@Module({
  imports: [AIModule],
  controllers: [AgentDeskController],
  providers: [SessionService, FileParserService, ChatService, AnalyzerService, ExecutorService],
  exports: [SessionService, FileParserService, ChatService, AnalyzerService, ExecutorService],
})
export class AgentDeskModule implements OnModuleInit {
  constructor(
    private readonly sessionService: SessionService,
    private readonly fileParserService: FileParserService,
    private readonly chatService: ChatService,
    private readonly analyzerService: AnalyzerService,
    private readonly executorService: ExecutorService,
  ) {}

  onModuleInit() {
    injectAgentDeskServices({
      sessionService: this.sessionService,
      fileParserService: this.fileParserService,
      chatService: this.chatService,
      analyzerService: this.analyzerService,
      executorService: this.executorService,
    });
  }
}
```

**Step 2: index.ts에 새 서비스 export 추가**

`packages/features/agent-desk/index.ts` 전체 교체:

```typescript
/**
 * Agent Desk Feature - Server
 */

// Module
export { AgentDeskModule } from "./agent-desk.module";

// tRPC Router
export { agentDeskRouter, type AgentDeskRouter } from "./trpc";

// Services
export { SessionService, FileParserService, ChatService, AnalyzerService, ExecutorService } from "./service";

// Types
export * from "./types";
```

**Step 3: Commit**

```bash
git add packages/features/agent-desk/agent-desk.module.ts packages/features/agent-desk/index.ts
git commit -m "feat(agent-desk): register AnalyzerService and ExecutorService in module"
```

---

### Task 11: Frontend — Pipeline 훅 추가

**Files:**
- Create: `apps/app/src/features/agent-desk/hooks/use-analyze.ts`
- Create: `apps/app/src/features/agent-desk/hooks/use-execute.ts`
- Create: `apps/app/src/features/agent-desk/hooks/use-execution-stream.ts`
- Modify: `apps/app/src/features/agent-desk/hooks/index.ts`

**Step 1: useAnalyze 훅**

Create `apps/app/src/features/agent-desk/hooks/use-analyze.ts`:

```typescript
import { useTRPC } from "../../../lib/trpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useAnalyze() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation({
    ...trpc.agentDesk.analyze.mutationOptions(),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: trpc.agentDesk.getSession.queryKey({ id: variables.sessionId }),
      });
    },
  });
}
```

**Step 2: useExecutionStream 훅**

Create `apps/app/src/features/agent-desk/hooks/use-execution-stream.ts`:

```typescript
import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSseStream } from "@repo/ui/hooks/use-sse-stream";
import { useTRPC, getAuthHeaders, API_URL } from "../../../lib/trpc";
import type { ExecutionEvent } from "../types";

export function useExecutionStream() {
  const [events, setEvents] = useState<ExecutionEvent[]>([]);
  const [latestLog, setLatestLog] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<{ prUrl?: string; prNumber?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  const { send: sseSend, abort, isStreaming } = useSseStream<ExecutionEvent & { type: string }>({
    url: `${API_URL}/api/agent-desk/pipeline/execute`,
    getHeaders: () => getAuthHeaders(),
  });

  const execute = useCallback(
    async (sessionId: string) => {
      setEvents([]);
      setLatestLog("");
      setIsExecuting(true);
      setResult(null);
      setError(null);

      await sseSend({
        body: { sessionId },
        onEvent: (event) => {
          setEvents((prev) => [...prev, event]);

          if (event.type === "log" && event.content) {
            setLatestLog(event.content);
          } else if (event.type === "result") {
            setResult({ prUrl: event.prUrl, prNumber: event.prNumber });
          } else if (event.type === "error") {
            setError(event.message ?? "실행 오류");
          } else if (event.type === "status") {
            queryClient.invalidateQueries({
              queryKey: trpc.agentDesk.getSession.queryKey({ id: sessionId }),
            });
          }
        },
        onComplete: () => {
          setIsExecuting(false);
          queryClient.invalidateQueries({
            queryKey: trpc.agentDesk.getSession.queryKey({ id: sessionId }),
          });
        },
      });

      setIsExecuting(false);
    },
    [sseSend, queryClient, trpc],
  );

  return { execute, abort, isExecuting: isExecuting || isStreaming, events, latestLog, result, error };
}
```

**Step 3: useCancelExecution 훅**

Create `apps/app/src/features/agent-desk/hooks/use-execute.ts`:

```typescript
import { useTRPC } from "../../../lib/trpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useCancelExecution() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation({
    ...trpc.agentDesk.cancelExecution.mutationOptions(),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: trpc.agentDesk.getSession.queryKey({ id: variables.sessionId }),
      });
    },
  });
}
```

**Step 4: hooks/index.ts 업데이트**

`apps/app/src/features/agent-desk/hooks/index.ts` 전체 교체:

```typescript
export {
  useSessions,
  useSession,
  useCreateSession,
  useDeleteSession,
  useUpdateSessionStatus,
  useSendMessage,
  useMessages,
  useConfirmUpload,
  useRemoveFile,
  useParseFile,
  useFiles,
} from "./use-agent-desk";
export { useStreamChat } from "./use-stream-chat";
export { useFileUpload } from "./use-file-upload";
export { useAnalyze } from "./use-analyze";
export { useExecutionStream } from "./use-execution-stream";
export { useCancelExecution } from "./use-execute";
```

**Step 5: Commit**

```bash
git add apps/app/src/features/agent-desk/hooks/
git commit -m "feat(agent-desk): add pipeline hooks (useAnalyze, useExecutionStream, useCancelExecution)"
```

---

### Task 12: Frontend — Pipeline Panel 컴포넌트

**Files:**
- Create: `apps/app/src/features/agent-desk/components/pipeline-panel.tsx`
- Create: `apps/app/src/features/agent-desk/components/execution-log.tsx`
- Create: `apps/app/src/features/agent-desk/types/index.ts` (client types)

**Step 1: Client types 파일 생성**

Create `apps/app/src/features/agent-desk/types/index.ts`:

```typescript
export type SessionType = "customer" | "operator";
export type SessionStatus =
  | "uploading" | "parsing" | "analyzing" | "analyzed"
  | "reviewed" | "spec_generated" | "project_created"
  | "executing" | "executed" | "failed";

export interface AnalysisFeature {
  name: string;
  description: string;
  priority: "high" | "medium" | "low";
  complexity: "simple" | "moderate" | "complex";
  existingFeatures: string[];
  gaps: string[];
}

export interface AnalysisResult {
  features: AnalysisFeature[];
  summary: string;
  recommendation: string;
}

export interface ExecutionEvent {
  type: "status" | "log" | "progress" | "result" | "error" | "done";
  status?: SessionStatus;
  content?: string;
  step?: string;
  total?: number;
  prUrl?: string;
  prNumber?: number;
  message?: string;
}
```

**Step 2: ExecutionLog 컴포넌트**

Create `apps/app/src/features/agent-desk/components/execution-log.tsx`:

```typescript
import { useRef, useEffect } from "react";
import { Loader2 } from "lucide-react";
import type { ExecutionEvent } from "../types";

interface Props {
  events: ExecutionEvent[];
  isExecuting: boolean;
}

export function ExecutionLog({ events, isExecuting }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  const logEvents = events.filter((e) => e.type === "log" || e.type === "progress");

  return (
    <div className="max-h-48 overflow-y-auto rounded-lg bg-muted/50 p-3 font-mono text-sm">
      {logEvents.map((event, i) => (
        <div key={i} className="text-muted-foreground">
          {event.type === "progress" && event.step ? `> ${event.step}` : event.content}
        </div>
      ))}
      {isExecuting && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          <span>실행 중...</span>
        </div>
      )}
      <div ref={scrollRef} />
    </div>
  );
}
```

**Step 3: PipelinePanel 컴포넌트**

Create `apps/app/src/features/agent-desk/components/pipeline-panel.tsx`:

```typescript
import { Button } from "@repo/ui/shadcn/button";
import {
  Play,
  Square,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { ExecutionLog } from "./execution-log";
import type { AnalysisResult, ExecutionEvent } from "../types";

interface Props {
  sessionType: "customer" | "operator";
  status: string;
  analysisResult: AnalysisResult | null;
  executionEvents: ExecutionEvent[];
  executionResult: { prUrl?: string; prNumber?: number } | null;
  executionError: string | null;
  isAnalyzing: boolean;
  isExecuting: boolean;
  onAnalyze: () => void;
  onExecute: () => void;
  onCancel: () => void;
  onRetry: () => void;
}

export function PipelinePanel({
  sessionType,
  status,
  analysisResult,
  executionEvents,
  executionResult,
  executionError,
  isAnalyzing,
  isExecuting,
  onExecute,
  onCancel,
  onRetry,
}: Props) {
  if (status === "analyzing" || isAnalyzing) {
    return (
      <PanelContainer>
        <div className="flex items-center gap-3">
          <Loader2 className="size-5 animate-spin text-primary" />
          <div>
            <p className="font-medium">Feature 분석 중...</p>
            <p className="text-sm text-muted-foreground">요구사항을 분석하고 있습니다</p>
          </div>
        </div>
      </PanelContainer>
    );
  }

  if (status === "analyzed" && analysisResult && !isExecuting) {
    return (
      <PanelContainer>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-5 text-green-600" />
          <p className="font-medium">분석 완료</p>
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {analysisResult.features.map((feature, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
              <div>
                <span className="font-medium">{feature.name}</span>
                <span className="ml-2 text-sm text-muted-foreground">{feature.description}</span>
              </div>
              <div className="flex gap-2">
                <PriorityBadge priority={feature.priority} />
                <ComplexityBadge complexity={feature.complexity} />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{analysisResult.recommendation}</p>
        <Button className="mt-3" onClick={onExecute}>
          <Play className="mr-2 size-4" />
          스펙 생성 & 실행하기
        </Button>
      </PanelContainer>
    );
  }

  if (status === "executing" || status === "spec_generated" || isExecuting) {
    return (
      <PanelContainer>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Loader2 className="size-5 animate-spin text-primary" />
            <p className="font-medium">Feature 구현 중...</p>
          </div>
          <Button variant="outline" size="sm" onClick={onCancel}>
            <Square className="mr-1 size-3" />
            중지
          </Button>
        </div>
        <div className="mt-3">
          <ExecutionLog events={executionEvents} isExecuting={isExecuting} />
        </div>
      </PanelContainer>
    );
  }

  if (status === "executed" && executionResult) {
    return (
      <PanelContainer>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-5 text-green-600" />
          <p className="font-medium">
            {sessionType === "customer" ? "서비스 생성 완료" : "구현 완료"}
          </p>
        </div>
        {sessionType === "customer" ? (
          <div className="mt-3">
            <p className="text-sm text-muted-foreground">요청하신 서비스가 성공적으로 생성되었습니다.</p>
            {analysisResult && (
              <div className="mt-2 flex flex-col gap-1">
                {analysisResult.features.map((f, i) => (
                  <span key={i} className="text-sm">• {f.description}</span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-2 text-sm">
            {executionResult.prUrl && (
              <a
                href={executionResult.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:underline"
              >
                <ExternalLink className="size-3.5" />
                PR #{executionResult.prNumber}: {executionResult.prUrl}
              </a>
            )}
          </div>
        )}
      </PanelContainer>
    );
  }

  if (status === "failed") {
    return (
      <PanelContainer>
        <div className="flex items-center gap-2">
          <AlertCircle className="size-5 text-destructive" />
          <p className="font-medium">실행 실패</p>
        </div>
        {executionError && (
          <p className="mt-2 text-sm text-muted-foreground">{executionError}</p>
        )}
        <Button variant="outline" className="mt-3" onClick={onRetry}>
          <RotateCcw className="mr-2 size-4" />
          재시도
        </Button>
      </PanelContainer>
    );
  }

  return null;
}

/* -------------------------------------------------------------------------------------------------
 * Components
 * -----------------------------------------------------------------------------------------------*/

function PanelContainer({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border bg-background p-4 shadow-sm">{children}</div>;
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    high: "bg-destructive/10 text-destructive",
    medium: "bg-yellow-600/10 text-yellow-600",
    low: "bg-muted text-muted-foreground",
  };
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs ${colors[priority] ?? colors.low}`}>
      {priority}
    </span>
  );
}

function ComplexityBadge({ complexity }: { complexity: string }) {
  const colors: Record<string, string> = {
    complex: "bg-destructive/10 text-destructive",
    moderate: "bg-yellow-600/10 text-yellow-600",
    simple: "bg-green-600/10 text-green-600",
  };
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs ${colors[complexity] ?? colors.moderate}`}>
      {complexity}
    </span>
  );
}
```

**Step 4: Commit**

```bash
git add apps/app/src/features/agent-desk/components/pipeline-panel.tsx apps/app/src/features/agent-desk/components/execution-log.tsx apps/app/src/features/agent-desk/types/
git commit -m "feat(agent-desk): add PipelinePanel, ExecutionLog components and client types"
```

---

### Task 13: Frontend — Chat 페이지에 Pipeline 통합

**Files:**
- Modify: `apps/app/src/features/agent-desk/pages/chat.tsx`

**Step 1: import 추가 (파일 상단)**

기존 import 뒤에 추가:
```typescript
import { PipelinePanel } from "../components/pipeline-panel";
import { useAnalyze, useExecutionStream, useCancelExecution } from "../hooks";
import type { AnalysisResult } from "../types";
```

**Step 2: Chat 컴포넌트에 pipeline 훅 추가**

기존 `useFileUpload(sessionId)` 뒤에 추가:
```typescript
const analyze = useAnalyze();
const { execute, abort: abortExecution, isExecuting, events: executionEvents, result: executionResult, error: executionError } = useExecutionStream();
const cancelExecution = useCancelExecution();
```

**Step 3: [ANALYZE_REQUEST] 마커 감지 useEffect 추가**

기존 `scrollIntoView` useEffect 뒤에 추가:
```typescript
useEffect(() => {
  if (!isStreaming && session?.messages) {
    const lastMsg = session.messages[session.messages.length - 1];
    if (
      lastMsg?.role === "agent" &&
      lastMsg.content.includes("[ANALYZE_REQUEST]") &&
      session.status !== "analyzing" &&
      session.status !== "analyzed" &&
      session.status !== "executing" &&
      session.status !== "executed"
    ) {
      analyze.mutate({ sessionId });
    }
  }
}, [isStreaming, session?.messages, session?.status, analyze, sessionId]);
```

**Step 4: 메시지에서 마커 제거**

기존 `session.messages.map` 부분의 `content={msg.content}` 변경:
```typescript
content={msg.content.replace("[ANALYZE_REQUEST]", "").trim()}
```

**Step 5: PipelinePanel 삽입**

`<div ref={messagesEndRef} />` 바로 위에 추가:
```typescript
{(session.status === "analyzing" || session.status === "analyzed" ||
  session.status === "spec_generated" || session.status === "executing" ||
  session.status === "executed" || session.status === "failed") && (
  <PipelinePanel
    sessionType={session.type as "customer" | "operator"}
    status={session.status}
    analysisResult={(session as any).analysisResult as AnalysisResult | null}
    executionEvents={executionEvents}
    executionResult={executionResult}
    executionError={executionError}
    isAnalyzing={analyze.isPending}
    isExecuting={isExecuting}
    onAnalyze={() => analyze.mutate({ sessionId })}
    onExecute={() => execute(sessionId)}
    onCancel={() => {
      abortExecution();
      cancelExecution.mutate({ sessionId });
    }}
    onRetry={() => {
      if ((session as any).analysisResult) {
        execute(sessionId);
      } else {
        analyze.mutate({ sessionId });
      }
    }}
  />
)}
```

**Step 6: Commit**

```bash
git add apps/app/src/features/agent-desk/pages/chat.tsx
git commit -m "feat(agent-desk): integrate PipelinePanel into Chat page with marker detection"
```

---

### Task 14: 전체 빌드 검증

**Step 1: Backend TypeScript**

Run: `cd apps/server && pnpm tsc --noEmit`
Expected: 에러 없음

**Step 2: Frontend TypeScript**

Run: `cd apps/app && pnpm tsc --noEmit`
Expected: 에러 없음

**Step 3: Drizzle Schema**

Run: `cd packages/drizzle && pnpm tsc --noEmit`
Expected: 에러 없음

**Step 4: Tests**

Run: `cd packages/features/agent-desk && npx jest --passWithNoTests`
Expected: 모든 테스트 통과

**Step 5: git status 확인**

Run: `git status`
Expected: agent-desk 관련 파일만 변경, 다른 Feature 미수정

---

### Task 15: Reference 문서 업데이트

**Files:**
- Modify: `docs/reference/features-backend.md`
- Modify: `docs/reference/database-schema.md`
- Modify: `docs/reference/features-frontend.md`

**Step 1: features-backend.md — Agent Desk 섹션에 추가**

- `AnalyzerService`: LLM 기반 요구사항 분석 + 스펙 생성
- `ExecutorService`: Git Worktree + Claude Agent SDK 실행
- 새 tRPC: `analyze`, `execute`, `cancelExecution`, `getExecution`
- 새 REST: `POST /api/agent-desk/pipeline/analyze`, `POST /api/agent-desk/pipeline/execute` (SSE), `POST /api/agent-desk/pipeline/cancel`, `GET /api/agent-desk/pipeline/status/:sessionId`

**Step 2: database-schema.md — Agent Desk 섹션에 추가**

- `agent_desk_sessions`: `analysis_result` (jsonb), `spec` (text), `error_message` (text) 컬럼
- `agent_desk_executions`: 새 테이블
- `agent_desk_execution_status`: 새 enum

**Step 3: features-frontend.md — Agent Desk 섹션에 추가**

- `PipelinePanel`, `ExecutionLog` 컴포넌트
- `useAnalyze`, `useExecutionStream`, `useCancelExecution` 훅

**Step 4: Commit**

```bash
git add docs/reference/
git commit -m "docs(agent-desk): update reference docs with pipeline services, schema, and components"
```
