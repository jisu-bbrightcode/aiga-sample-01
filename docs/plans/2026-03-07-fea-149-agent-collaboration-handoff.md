# [FEA-149] Agent Collaboration & Implementation Handoff Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement AI suggestion cards, structured questions, and implementation handoff generation for the Agent Desk flow editor (FRD-AD-218 ~ FRD-AD-225).

**Architecture:** Extend the existing agent-desk feature with 3 new services: FlowAgentService (AI structured Q&A + suggestion cards), HandoffComposerService (implementation handoff package), and UiComponentResolverService (packages/ui component scanning). All services follow the existing NestJS Injectable pattern and share the LLMService + Drizzle DB. Frontend adds suggestion card components in the chat panel and a handoff viewer dialog.

**Tech Stack:** NestJS, Drizzle ORM, tRPC v11, Zod, React 19, TanStack Query, Jotai, @xyflow/react, shadcn/Base-UI

---

## Task 1: Backend Types — AI Suggestion, Structured Question, Handoff, UiSpec

**Files:**
- Modify: `packages/features/agent-desk/types/index.ts`

**Step 1: Add new type definitions**

Append to `packages/features/agent-desk/types/index.ts`:

```typescript
// ============================================================================
// AI Suggestion & Structured Question Types (FRD-AD-218~220)
// ============================================================================

export type SuggestionAction = "apply" | "ignore" | "modify";

export interface StructuredQuestion {
  id: string;
  slot: "role" | "goal" | "input" | "exception" | "branch";
  question: string;
  context?: string;
  targetScreenId?: string;
}

export interface AiSuggestion {
  id: string;
  type: "add_screen" | "remove_screen" | "update_screen" | "add_edge" | "update_edge" | "update_detail";
  title: string;
  description: string;
  previewData: Record<string, unknown>;
  affectedNodeIds: string[];
  status: "pending" | "applied" | "ignored";
}

export interface FlowAgentResponse {
  reply: string;
  questions: StructuredQuestion[];
  suggestions: AiSuggestion[];
}

// ============================================================================
// UI Spec Contract Types (FRD-AD-222~223)
// ============================================================================

export interface UiComponent {
  type: string;
  source: "shadcn" | "custom" | "layout" | "block";
  importPath: string;
  label?: string;
  props?: Record<string, unknown>;
  dataBinding?: string;
  actions?: string[];
  visibilityRule?: string;
  children?: UiComponent[];
  todoReason?: string;
}

export interface UiSpecSection {
  id: string;
  title: string;
  order: number;
  components: UiComponent[];
}

export interface UiSpec {
  screenId: string;
  layoutType: string;
  sections: UiSpecSection[];
  stateVariants: Record<string, Record<string, unknown>>;
  responsiveRules: Record<string, string>;
  designConstraints?: string[];
}

// ============================================================================
// Implementation Handoff Types (FRD-AD-225)
// ============================================================================

export interface RouterMapEntry {
  screenId: string;
  screenName: string;
  routePath: string;
  parentRoute: string;
  authRule: "public" | "protected" | "admin";
}

export interface ScreenSpec {
  screenId: string;
  screenName: string;
  screenGoal: string;
  features: string[];
  uiDescription: string;
  states: string[];
  dataDependencies: string[];
}

export interface NavigationRule {
  from: string;
  to: string;
  trigger: string;
  condition?: string;
  fallback?: string;
}

export interface ImplementationNote {
  category: "api" | "entity" | "validation" | "unresolved";
  content: string;
  todoReason?: string;
}

export interface HandoffArtifact {
  type: "spec_draft" | "mermaid" | "qa_mapping" | "source_trace";
  title: string;
  content: string;
}

export interface ImplementationHandoff {
  routerMap: RouterMapEntry[];
  screenSpecs: ScreenSpec[];
  uiSpecs: UiSpec[];
  navigationRules: NavigationRule[];
  implementationNotes: ImplementationNote[];
  artifacts: HandoffArtifact[];
}

// ============================================================================
// UI Component Resolver Types
// ============================================================================

export interface ResolvedComponent {
  name: string;
  source: "shadcn" | "custom" | "layout" | "block";
  importPath: string;
  category?: string;
  exports?: string[];
}

export interface ResolvedBlock {
  name: string;
  source: "block";
  importPath: string;
  kind: string;
  reason?: string;
}
```

**Step 2: Verify types compile**

Run: `cd packages/features && pnpm tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/features/agent-desk/types/index.ts
git commit -m "feat(agent-desk): add AI suggestion, handoff, and UI spec types (FEA-149)"
```

---

## Task 2: Backend DTOs — Flow Agent, Suggestion, Handoff, UI Resolver

**Files:**
- Create: `packages/features/agent-desk/dto/flow-agent.dto.ts`
- Modify: `packages/features/agent-desk/dto/index.ts`

**Step 1: Create flow-agent.dto.ts**

```typescript
import { z } from "zod";

export const askFlowAgentSchema = z.object({
  sessionId: z.string().uuid().describe("세션 ID"),
  message: z.string().min(1).describe("사용자 메시지"),
  contextSelection: z.object({
    screenIds: z.array(z.string().uuid()).optional().describe("선택된 화면 ID 목록"),
    edgeIds: z.array(z.string().uuid()).optional().describe("선택된 엣지 ID 목록"),
  }).optional().describe("현재 선택 컨텍스트"),
  model: z.string().optional().describe("사용할 LLM 모델"),
});
export type AskFlowAgentDto = z.infer<typeof askFlowAgentSchema>;

export const applyAiSuggestionSchema = z.object({
  sessionId: z.string().uuid().describe("세션 ID"),
  suggestionId: z.string().uuid().describe("제안 ID"),
  action: z.enum(["apply", "ignore", "modify"]).describe("적용 액션"),
  modifications: z.record(z.unknown()).optional().describe("수정 사항 (modify 시)"),
});
export type ApplyAiSuggestionDto = z.infer<typeof applyAiSuggestionSchema>;

export const generateImplementationHandoffSchema = z.object({
  sessionId: z.string().uuid().describe("세션 ID"),
  includeRoutes: z.boolean().default(true).describe("라우터 맵 포함"),
  includeQa: z.boolean().default(false).describe("QA 매핑 포함"),
  includeUiSpecs: z.boolean().default(true).describe("UI 스펙 포함"),
  resolveUiComponents: z.boolean().default(true).describe("UI 컴포넌트 자동 해석"),
  model: z.string().optional().describe("사용할 LLM 모델"),
});
export type GenerateImplementationHandoffDto = z.infer<typeof generateImplementationHandoffSchema>;

export const resolveUiComponentsSchema = z.object({
  sessionId: z.string().uuid().describe("세션 ID"),
  screenIds: z.array(z.string().uuid()).optional().describe("특정 화면만 해석"),
  componentHints: z.array(z.string()).optional().describe("컴포넌트 힌트"),
});
export type ResolveUiComponentsDto = z.infer<typeof resolveUiComponentsSchema>;
```

**Step 2: Update dto/index.ts**

Add to `packages/features/agent-desk/dto/index.ts`:
```typescript
export * from "./flow-agent.dto";
```

**Step 3: Verify**

Run: `cd packages/features && pnpm tsc --noEmit`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/features/agent-desk/dto/flow-agent.dto.ts packages/features/agent-desk/dto/index.ts
git commit -m "feat(agent-desk): add flow agent and handoff DTOs (FEA-149)"
```

---

## Task 3: Backend Service — FlowAgentService

**Files:**
- Create: `packages/features/agent-desk/service/flow-agent.service.ts`
- Modify: `packages/features/agent-desk/service/index.ts`

**Step 1: Create FlowAgentService**

This service handles `askFlowAgent` (FRD-AD-220~221) and `applyAiSuggestion` (FRD-AD-218, 224).

```typescript
import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { InjectDrizzle, type DrizzleDB } from "@repo/drizzle";
import { agentDeskSessions } from "@repo/drizzle";
import { createLogger } from "@repo/core/logger";
import { LLMService } from "@repo/features/ai";
import type { AiSuggestion, FlowAgentResponse, StructuredQuestion, ChatMessage } from "../types";
import type { FlowData, FlowScreen } from "./flow-designer.service";
import type { FlowEdge, ScreenDetail } from "../types";
import type { AskFlowAgentDto, ApplyAiSuggestionDto } from "../dto/flow-agent.dto";
import { SessionService } from "./session.service";

const logger = createLogger("agent-desk");

const FLOW_AGENT_SYSTEM_PROMPT = `당신은 화면 흐름 설계를 돕는 AI 에이전트입니다.
사용자의 질문에 답하면서 다음을 수행합니다:

1. **구조화 질문**: 부족한 정보나 충돌 지점을 발견하면 구조화 질문을 생성합니다.
   - slot: role(역할), goal(목표), input(입력), exception(예외), branch(분기)
2. **제안 카드**: 화면 추가/수정/삭제, 전이 변경 등 구조적 변경안을 제안합니다.

응답은 반드시 다음 JSON 형식으로:
{
  "reply": "자연어 응답 텍스트",
  "questions": [
    {
      "id": "uuid-v4",
      "slot": "role|goal|input|exception|branch",
      "question": "질문 내용",
      "context": "질문 배경 (선택)",
      "targetScreenId": "관련 화면 ID (선택)"
    }
  ],
  "suggestions": [
    {
      "id": "uuid-v4",
      "type": "add_screen|remove_screen|update_screen|add_edge|update_edge|update_detail",
      "title": "제안 제목",
      "description": "제안 설명",
      "previewData": { ... },
      "affectedNodeIds": ["화면ID1"]
    }
  ]
}

UUID는 하이픈 포함 36자 형식으로 생성하세요.
reply는 항상 포함하고, questions와 suggestions는 필요할 때만 포함하세요.
suggestions의 previewData는 적용 시 변경될 데이터의 미리보기입니다.`;

@Injectable()
export class FlowAgentService {
  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly sessionService: SessionService,
    private readonly llmService: LLMService,
  ) {}

  async askFlowAgent(input: AskFlowAgentDto, userId: string): Promise<FlowAgentResponse> {
    await this.sessionService.verifySessionOwnership(input.sessionId, userId);

    const session = await this.db.query.agentDeskSessions.findFirst({
      where: eq(agentDeskSessions.id, input.sessionId),
      columns: { id: true, flowData: true },
    });

    if (!session) throw new NotFoundException(`Session not found: ${input.sessionId}`);

    const flowData = (session.flowData as FlowData) ?? { screens: [], currentScreenIndex: 0, edges: [] };
    const messages = await this.sessionService.getMessages(input.sessionId);

    // Build context
    const flowContext = this.buildFlowContext(flowData, input.contextSelection);
    const history: ChatMessage[] = messages.slice(-10).map((m) => ({
      role: m.role === "agent" ? "assistant" as const : "user" as const,
      content: m.content,
    }));

    const chatMessages: ChatMessage[] = [
      { role: "system", content: FLOW_AGENT_SYSTEM_PROMPT },
      { role: "system", content: `현재 화면 흐름 상태:\n${flowContext}` },
      ...history,
      { role: "user", content: input.message },
    ];

    const response = await this.llmService.chatCompletion(
      chatMessages,
      input.model ? { model: input.model, jsonMode: true } : { jsonMode: true },
    );

    // Save user message
    await this.sessionService.addMessage(input.sessionId, "user", input.message);

    // Parse response
    const parsed = this.parseAgentResponse(response);

    // Save agent reply
    await this.sessionService.addMessage(input.sessionId, "agent", parsed.reply);

    // Store suggestions in session metadata for later apply
    if (parsed.suggestions.length > 0) {
      await this.storeSuggestions(input.sessionId, parsed.suggestions);
    }

    logger.info("Flow agent responded", {
      "agent_desk.session_id": input.sessionId,
      "agent_desk.question_count": parsed.questions.length,
      "agent_desk.suggestion_count": parsed.suggestions.length,
    });

    return parsed;
  }

  async applyAiSuggestion(input: ApplyAiSuggestionDto, userId: string) {
    await this.sessionService.verifySessionOwnership(input.sessionId, userId);

    const session = await this.db.query.agentDeskSessions.findFirst({
      where: eq(agentDeskSessions.id, input.sessionId),
      columns: { id: true, flowData: true, metadata: true },
    });

    if (!session) throw new NotFoundException(`Session not found: ${input.sessionId}`);

    const metadata = (session.metadata as Record<string, unknown>) ?? {};
    const storedSuggestions = (metadata.pendingSuggestions as AiSuggestion[]) ?? [];
    const suggestion = storedSuggestions.find((s) => s.id === input.suggestionId);

    if (!suggestion) throw new NotFoundException(`Suggestion not found: ${input.suggestionId}`);

    if (input.action === "ignore") {
      suggestion.status = "ignored";
      await this.updateSuggestionStatus(input.sessionId, metadata, storedSuggestions);
      logger.info("AI suggestion ignored", {
        "agent_desk.session_id": input.sessionId,
        "agent_desk.suggestion_id": input.suggestionId,
      });
      return { applied: false, flowData: session.flowData };
    }

    // Apply the suggestion to flowData
    const flowData = (session.flowData as FlowData) ?? { screens: [], currentScreenIndex: 0, edges: [] };
    const previewData = input.action === "modify" && input.modifications
      ? { ...suggestion.previewData, ...input.modifications }
      : suggestion.previewData;

    this.applySuggestionToFlowData(flowData, suggestion.type, previewData);
    suggestion.status = "applied";

    await this.db
      .update(agentDeskSessions)
      .set({ flowData, metadata: { ...metadata, pendingSuggestions: storedSuggestions } })
      .where(eq(agentDeskSessions.id, input.sessionId));

    logger.info("AI suggestion applied", {
      "agent_desk.session_id": input.sessionId,
      "agent_desk.suggestion_id": input.suggestionId,
      "agent_desk.suggestion_type": suggestion.type,
    });

    return { applied: true, flowData };
  }

  private buildFlowContext(
    flowData: FlowData,
    contextSelection?: { screenIds?: string[]; edgeIds?: string[] },
  ): string {
    const parts: string[] = [];

    parts.push(`화면 수: ${flowData.screens.length}`);
    parts.push(`엣지 수: ${flowData.edges?.length ?? 0}`);

    if (flowData.screens.length > 0) {
      parts.push("\n화면 목록:");
      for (const screen of flowData.screens) {
        const selected = contextSelection?.screenIds?.includes(screen.id) ? " [선택됨]" : "";
        parts.push(`- ${screen.name} (${screen.wireframeType})${selected}: ${screen.description}`);
        if (screen.detail) {
          if (screen.detail.routePath) parts.push(`  경로: ${screen.detail.routePath}`);
          if (screen.detail.screenGoal) parts.push(`  목적: ${screen.detail.screenGoal}`);
        }
      }
    }

    if (flowData.edges && flowData.edges.length > 0) {
      parts.push("\n전이 목록:");
      for (const edge of flowData.edges) {
        const fromScreen = flowData.screens.find((s) => s.id === edge.fromScreenId);
        const toScreen = flowData.screens.find((s) => s.id === edge.toScreenId);
        parts.push(`- ${fromScreen?.name ?? "?"} → ${toScreen?.name ?? "?"}: ${edge.conditionLabel} (${edge.transitionType})`);
      }
    }

    return parts.join("\n");
  }

  private parseAgentResponse(response: string): FlowAgentResponse {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { reply: response, questions: [], suggestions: [] };
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        reply: parsed.reply ?? response,
        questions: (parsed.questions ?? []).map((q: StructuredQuestion) => ({
          ...q,
          id: q.id ?? crypto.randomUUID(),
        })),
        suggestions: (parsed.suggestions ?? []).map((s: AiSuggestion) => ({
          ...s,
          id: s.id ?? crypto.randomUUID(),
          status: "pending" as const,
        })),
      };
    } catch {
      return { reply: response, questions: [], suggestions: [] };
    }
  }

  private async storeSuggestions(sessionId: string, suggestions: AiSuggestion[]) {
    const session = await this.db.query.agentDeskSessions.findFirst({
      where: eq(agentDeskSessions.id, sessionId),
      columns: { id: true, metadata: true },
    });

    const metadata = (session?.metadata as Record<string, unknown>) ?? {};
    const existing = (metadata.pendingSuggestions as AiSuggestion[]) ?? [];
    const updated = [...existing.filter((s) => s.status === "pending"), ...suggestions];

    await this.db
      .update(agentDeskSessions)
      .set({ metadata: { ...metadata, pendingSuggestions: updated } })
      .where(eq(agentDeskSessions.id, sessionId));
  }

  private async updateSuggestionStatus(
    sessionId: string,
    metadata: Record<string, unknown>,
    suggestions: AiSuggestion[],
  ) {
    await this.db
      .update(agentDeskSessions)
      .set({ metadata: { ...metadata, pendingSuggestions: suggestions } })
      .where(eq(agentDeskSessions.id, sessionId));
  }

  private applySuggestionToFlowData(
    flowData: FlowData,
    type: AiSuggestion["type"],
    previewData: Record<string, unknown>,
  ) {
    switch (type) {
      case "add_screen": {
        const newScreen = previewData as unknown as FlowScreen;
        flowData.screens.push({
          ...newScreen,
          order: flowData.screens.length,
          wireframeMermaid: newScreen.wireframeMermaid ?? "",
          nextScreenIds: newScreen.nextScreenIds ?? [],
          metadata: newScreen.metadata ?? {},
        });
        break;
      }
      case "remove_screen": {
        const screenId = previewData.screenId as string;
        flowData.screens = flowData.screens.filter((s) => s.id !== screenId);
        if (flowData.edges) {
          flowData.edges = flowData.edges.filter(
            (e) => e.fromScreenId !== screenId && e.toScreenId !== screenId,
          );
        }
        break;
      }
      case "update_screen": {
        const { screenId: sid, ...updates } = previewData as Record<string, unknown> & { screenId: string };
        const screen = flowData.screens.find((s) => s.id === sid);
        if (screen) Object.assign(screen, updates);
        break;
      }
      case "update_detail": {
        const { screenId: detailSid, ...detailUpdates } = previewData as Record<string, unknown> & { screenId: string };
        const detailScreen = flowData.screens.find((s) => s.id === detailSid);
        if (detailScreen) {
          detailScreen.detail = { ...detailScreen.detail, ...(detailUpdates as Partial<ScreenDetail>) };
        }
        break;
      }
      case "add_edge": {
        const newEdge = previewData as unknown as FlowEdge;
        if (!flowData.edges) flowData.edges = [];
        flowData.edges.push(newEdge);
        break;
      }
      case "update_edge": {
        const { edgeId, ...edgeUpdates } = previewData as Record<string, unknown> & { edgeId: string };
        const edge = flowData.edges?.find((e) => e.id === edgeId);
        if (edge) Object.assign(edge, edgeUpdates);
        break;
      }
    }
  }
}
```

**Step 2: Update service/index.ts**

Add: `export { FlowAgentService } from "./flow-agent.service";`

**Step 3: Verify**

Run: `cd packages/features && pnpm tsc --noEmit`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/features/agent-desk/service/flow-agent.service.ts packages/features/agent-desk/service/index.ts
git commit -m "feat(agent-desk): add FlowAgentService for structured Q&A and suggestion cards (FEA-149)"
```

---

## Task 4: Backend Service — HandoffComposerService

**Files:**
- Create: `packages/features/agent-desk/service/handoff-composer.service.ts`
- Modify: `packages/features/agent-desk/service/index.ts`

**Step 1: Create HandoffComposerService**

This service generates the implementation handoff package (FRD-AD-225).

```typescript
import { Injectable, NotFoundException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { InjectDrizzle, type DrizzleDB } from "@repo/drizzle";
import { agentDeskSessions, agentDeskNormalizedRequirements } from "@repo/drizzle";
import { createLogger } from "@repo/core/logger";
import { LLMService } from "@repo/features/ai";
import type {
  ImplementationHandoff,
  RouterMapEntry,
  ScreenSpec,
  UiSpec,
  NavigationRule,
  ImplementationNote,
  HandoffArtifact,
  ChatMessage,
} from "../types";
import type { FlowData } from "./flow-designer.service";
import type { GenerateImplementationHandoffDto } from "../dto/flow-agent.dto";
import { SessionService } from "./session.service";

const logger = createLogger("agent-desk");

const HANDOFF_SYSTEM_PROMPT = `당신은 구현 인계 패키지를 생성하는 전문가입니다.
화면 흐름 데이터와 요구사항을 분석하여 개발자가 바로 구현에 착수할 수 있는 패키지를 만듭니다.

응답은 반드시 다음 JSON 형식으로:
{
  "routerMap": [
    { "screenId": "...", "screenName": "...", "routePath": "/...", "parentRoute": "rootRoute", "authRule": "public|protected|admin" }
  ],
  "screenSpecs": [
    { "screenId": "...", "screenName": "...", "screenGoal": "...", "features": [...], "uiDescription": "...", "states": [...], "dataDependencies": [...] }
  ],
  "uiSpecs": [
    {
      "screenId": "...",
      "layoutType": "form-page|list-page|detail-page|dashboard|split-view|modal",
      "sections": [
        { "id": "...", "title": "...", "order": 1, "components": [
          { "type": "ComponentName", "source": "shadcn|custom|layout|block", "importPath": "@repo/ui/...", "label": "...", "props": {} }
        ]}
      ],
      "stateVariants": { "loading": {...}, "empty": {...}, "error": {...} },
      "responsiveRules": { "mobile": "...", "desktop": "..." }
    }
  ],
  "navigationRules": [
    { "from": "screenName1", "to": "screenName2", "trigger": "...", "condition": "...", "fallback": "..." }
  ],
  "implementationNotes": [
    { "category": "api|entity|validation|unresolved", "content": "...", "todoReason": "..." }
  ]
}

규칙:
- 모든 컴포넌트 type은 실제 export 이름이어야 합니다.
- importPath는 @repo/ui/shadcn/*, @repo/ui/components/*, @repo/ui/layouts/* 형식.
- 대응 컴포넌트가 없으면 todoReason을 반환하세요.
- stateVariants는 base 화면과의 차이(diff) 중심으로 기록하세요.`;

@Injectable()
export class HandoffComposerService {
  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly sessionService: SessionService,
    private readonly llmService: LLMService,
  ) {}

  async generateHandoff(
    input: GenerateImplementationHandoffDto,
    userId: string,
  ): Promise<ImplementationHandoff> {
    await this.sessionService.verifySessionOwnership(input.sessionId, userId);

    const session = await this.db.query.agentDeskSessions.findFirst({
      where: eq(agentDeskSessions.id, input.sessionId),
      columns: { id: true, flowData: true, title: true },
    });

    if (!session) throw new NotFoundException(`Session not found: ${input.sessionId}`);

    const flowData = (session.flowData as FlowData) ?? { screens: [], currentScreenIndex: 0, edges: [] };

    if (flowData.screens.length === 0) {
      throw new NotFoundException("화면 데이터가 없습니다. 먼저 화면 후보를 생성해주세요.");
    }

    // Load requirements for context
    const requirements = await this.db.query.agentDeskNormalizedRequirements.findMany({
      where: eq(agentDeskNormalizedRequirements.sessionId, input.sessionId),
    });

    const requirementContext = requirements
      .map((r) => `[${r.category}] (ID: ${r.id}) ${r.summary}`)
      .join("\n");

    const flowContext = this.buildFlowContext(flowData);

    const chatMessages: ChatMessage[] = [
      { role: "system", content: HANDOFF_SYSTEM_PROMPT },
      {
        role: "user",
        content: `다음 화면 흐름과 요구사항을 기반으로 구현 인계 패키지를 생성해주세요.

## 화면 흐름
${flowContext}

## 요구사항
${requirementContext || "(요구사항 없음)"}

옵션:
- 라우터 맵 포함: ${input.includeRoutes}
- UI 스펙 포함: ${input.includeUiSpecs}
- QA 매핑 포함: ${input.includeQa}`,
      },
    ];

    const response = await this.llmService.chatCompletion(
      chatMessages,
      input.model ? { model: input.model, jsonMode: true } : { jsonMode: true },
    );

    const handoff = this.parseHandoffResponse(response, flowData);

    // Generate artifacts
    handoff.artifacts = this.generateArtifacts(flowData, handoff, session.title ?? "Untitled");

    // Store handoff in session metadata
    await this.storeHandoff(input.sessionId, handoff);

    logger.info("Implementation handoff generated", {
      "agent_desk.session_id": input.sessionId,
      "agent_desk.route_count": handoff.routerMap.length,
      "agent_desk.screen_spec_count": handoff.screenSpecs.length,
      "agent_desk.ui_spec_count": handoff.uiSpecs.length,
    });

    return handoff;
  }

  private buildFlowContext(flowData: FlowData): string {
    const parts: string[] = [];

    for (const screen of flowData.screens) {
      parts.push(`### ${screen.name} (${screen.wireframeType})`);
      parts.push(`설명: ${screen.description}`);
      if (screen.detail) {
        const d = screen.detail;
        if (d.screenGoal) parts.push(`목적: ${d.screenGoal}`);
        if (d.routePath) parts.push(`경로: ${d.routePath}`);
        if (d.primaryUser) parts.push(`사용자: ${d.primaryUser}`);
        if (d.keyElements?.length) parts.push(`핵심 요소: ${d.keyElements.join(", ")}`);
        if (d.inputs?.length) parts.push(`입력: ${d.inputs.join(", ")}`);
        if (d.actions?.length) parts.push(`액션: ${d.actions.join(", ")}`);
        if (d.states?.length) parts.push(`상태: ${d.states.join(", ")}`);
        if (d.entryConditions?.length) parts.push(`진입 조건: ${d.entryConditions.join(", ")}`);
        if (d.exitConditions?.length) parts.push(`이탈 조건: ${d.exitConditions.join(", ")}`);
      }
      parts.push("");
    }

    if (flowData.edges?.length) {
      parts.push("### 전이");
      for (const edge of flowData.edges) {
        const from = flowData.screens.find((s) => s.id === edge.fromScreenId)?.name ?? "?";
        const to = flowData.screens.find((s) => s.id === edge.toScreenId)?.name ?? "?";
        parts.push(`- ${from} → ${to}: ${edge.conditionLabel} (${edge.transitionType})`);
      }
    }

    return parts.join("\n");
  }

  private parseHandoffResponse(response: string, flowData: FlowData): ImplementationHandoff {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return this.buildFallbackHandoff(flowData);
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        routerMap: parsed.routerMap ?? [],
        screenSpecs: parsed.screenSpecs ?? [],
        uiSpecs: (parsed.uiSpecs ?? []).map((spec: UiSpec) => ({
          ...spec,
          sections: spec.sections ?? [],
          stateVariants: spec.stateVariants ?? {},
          responsiveRules: spec.responsiveRules ?? {},
        })),
        navigationRules: parsed.navigationRules ?? [],
        implementationNotes: parsed.implementationNotes ?? [],
        artifacts: [],
      };
    } catch {
      return this.buildFallbackHandoff(flowData);
    }
  }

  private buildFallbackHandoff(flowData: FlowData): ImplementationHandoff {
    return {
      routerMap: flowData.screens.map((s) => ({
        screenId: s.id,
        screenName: s.name,
        routePath: s.detail?.routePath ?? `/${s.name.toLowerCase().replace(/\s+/g, "-")}`,
        parentRoute: s.detail?.routeParent ?? "rootRoute",
        authRule: "protected" as const,
      })),
      screenSpecs: flowData.screens.map((s) => ({
        screenId: s.id,
        screenName: s.name,
        screenGoal: s.detail?.screenGoal ?? s.description,
        features: s.detail?.actions ?? [],
        uiDescription: s.description,
        states: s.detail?.states ?? [],
        dataDependencies: [],
      })),
      uiSpecs: [],
      navigationRules: (flowData.edges ?? []).map((e) => {
        const from = flowData.screens.find((s) => s.id === e.fromScreenId);
        const to = flowData.screens.find((s) => s.id === e.toScreenId);
        return {
          from: from?.name ?? e.fromScreenId,
          to: to?.name ?? e.toScreenId,
          trigger: e.conditionLabel,
          condition: e.transitionType,
        };
      }),
      implementationNotes: [{
        category: "unresolved" as const,
        content: "LLM 응답 파싱 실패로 기본 패키지가 생성되었습니다.",
        todoReason: "LLM 재시도 필요",
      }],
      artifacts: [],
    };
  }

  private generateArtifacts(
    flowData: FlowData,
    handoff: ImplementationHandoff,
    title: string,
  ): HandoffArtifact[] {
    const artifacts: HandoffArtifact[] = [];

    // Mermaid flowchart
    const mermaidLines = ["graph TD"];
    for (const screen of flowData.screens) {
      const label = screen.name.replace(/"/g, "'");
      mermaidLines.push(`  ${screen.id.slice(0, 8)}["${label}"]`);
    }
    for (const edge of flowData.edges ?? []) {
      const fromId = edge.fromScreenId.slice(0, 8);
      const toId = edge.toScreenId.slice(0, 8);
      const label = edge.conditionLabel ? `|${edge.conditionLabel}|` : "";
      mermaidLines.push(`  ${fromId} -->${label} ${toId}`);
    }
    artifacts.push({
      type: "mermaid",
      title: `${title} - Flow Chart`,
      content: mermaidLines.join("\n"),
    });

    // Source trace
    const traceLines = ["# Source Trace", ""];
    for (const screen of flowData.screens) {
      traceLines.push(`## ${screen.name}`);
      const reqIds = screen.detail?.sourceRequirementIds ?? [];
      if (reqIds.length > 0) {
        traceLines.push(`Requirements: ${reqIds.join(", ")}`);
      } else {
        traceLines.push("Requirements: (none)");
      }
      traceLines.push("");
    }
    artifacts.push({
      type: "source_trace",
      title: `${title} - Source Trace`,
      content: traceLines.join("\n"),
    });

    return artifacts;
  }

  private async storeHandoff(sessionId: string, handoff: ImplementationHandoff) {
    const session = await this.db.query.agentDeskSessions.findFirst({
      where: eq(agentDeskSessions.id, sessionId),
      columns: { id: true, metadata: true },
    });

    const metadata = (session?.metadata as Record<string, unknown>) ?? {};
    await this.db
      .update(agentDeskSessions)
      .set({ metadata: { ...metadata, implementationHandoff: handoff } })
      .where(eq(agentDeskSessions.id, sessionId));
  }
}
```

**Step 2: Update service/index.ts**

Add: `export { HandoffComposerService } from "./handoff-composer.service";`

**Step 3: Verify**

Run: `cd packages/features && pnpm tsc --noEmit`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/features/agent-desk/service/handoff-composer.service.ts packages/features/agent-desk/service/index.ts
git commit -m "feat(agent-desk): add HandoffComposerService for implementation handoff generation (FEA-149)"
```

---

## Task 5: Backend Service — UiComponentResolverService

**Files:**
- Create: `packages/features/agent-desk/service/ui-component-resolver.service.ts`
- Modify: `packages/features/agent-desk/service/index.ts`

**Step 1: Create UiComponentResolverService**

This service scans `packages/ui` to resolve available components (FRD-AD-223).

```typescript
import { Injectable } from "@nestjs/common";
import { createLogger } from "@repo/core/logger";
import type { ResolvedComponent, ResolvedBlock } from "../types";
import type { ResolveUiComponentsDto } from "../dto/flow-agent.dto";
import { SessionService } from "./session.service";

const logger = createLogger("agent-desk");

// Static registry of known shadcn components
const SHADCN_COMPONENTS: ResolvedComponent[] = [
  { name: "Button", source: "shadcn", importPath: "@repo/ui/shadcn/button", category: "input", exports: ["Button", "buttonVariants"] },
  { name: "Input", source: "shadcn", importPath: "@repo/ui/shadcn/input", category: "input", exports: ["Input"] },
  { name: "Textarea", source: "shadcn", importPath: "@repo/ui/shadcn/textarea", category: "input", exports: ["Textarea"] },
  { name: "Select", source: "shadcn", importPath: "@repo/ui/shadcn/select", category: "input", exports: ["Select", "SelectContent", "SelectItem", "SelectTrigger", "SelectValue"] },
  { name: "Dialog", source: "shadcn", importPath: "@repo/ui/shadcn/dialog", category: "overlay", exports: ["Dialog", "DialogContent", "DialogHeader", "DialogTitle", "DialogTrigger", "DialogDescription"] },
  { name: "Card", source: "shadcn", importPath: "@repo/ui/shadcn/card", category: "display", exports: ["Card", "CardContent", "CardDescription", "CardHeader", "CardTitle", "CardFooter"] },
  { name: "Table", source: "shadcn", importPath: "@repo/ui/shadcn/table", category: "display", exports: ["Table", "TableBody", "TableCell", "TableHead", "TableHeader", "TableRow"] },
  { name: "Tabs", source: "shadcn", importPath: "@repo/ui/shadcn/tabs", category: "navigation", exports: ["Tabs", "TabsContent", "TabsList", "TabsTrigger"] },
  { name: "Badge", source: "shadcn", importPath: "@repo/ui/shadcn/badge", category: "display", exports: ["Badge"] },
  { name: "Tooltip", source: "shadcn", importPath: "@repo/ui/shadcn/tooltip", category: "overlay", exports: ["Tooltip", "TooltipContent", "TooltipTrigger"] },
  { name: "Sheet", source: "shadcn", importPath: "@repo/ui/shadcn/sheet", category: "overlay", exports: ["Sheet", "SheetContent", "SheetHeader", "SheetTitle", "SheetTrigger"] },
  { name: "Skeleton", source: "shadcn", importPath: "@repo/ui/shadcn/skeleton", category: "display", exports: ["Skeleton"] },
  { name: "ScrollArea", source: "shadcn", importPath: "@repo/ui/shadcn/scroll-area", category: "layout", exports: ["ScrollArea"] },
  { name: "Separator", source: "shadcn", importPath: "@repo/ui/shadcn/separator", category: "layout", exports: ["Separator"] },
  { name: "Avatar", source: "shadcn", importPath: "@repo/ui/shadcn/avatar", category: "display", exports: ["Avatar", "AvatarFallback", "AvatarImage"] },
  { name: "DropdownMenu", source: "shadcn", importPath: "@repo/ui/shadcn/dropdown-menu", category: "overlay", exports: ["DropdownMenu", "DropdownMenuContent", "DropdownMenuItem", "DropdownMenuTrigger"] },
  { name: "Form", source: "shadcn", importPath: "@repo/ui/shadcn/form", category: "input", exports: ["Form", "FormControl", "FormField", "FormItem", "FormLabel", "FormMessage"] },
  { name: "Checkbox", source: "shadcn", importPath: "@repo/ui/shadcn/checkbox", category: "input", exports: ["Checkbox"] },
  { name: "Switch", source: "shadcn", importPath: "@repo/ui/shadcn/switch", category: "input", exports: ["Switch"] },
  { name: "Popover", source: "shadcn", importPath: "@repo/ui/shadcn/popover", category: "overlay", exports: ["Popover", "PopoverContent", "PopoverTrigger"] },
];

const CUSTOM_COMPONENTS: ResolvedComponent[] = [
  { name: "Feature", source: "custom", importPath: "@repo/ui/components/feature", category: "layout", exports: ["Feature"] },
  { name: "FeatureHeader", source: "custom", importPath: "@repo/ui/components/feature-header", category: "layout", exports: ["FeatureHeader"] },
  { name: "FeatureContents", source: "custom", importPath: "@repo/ui/components/feature-contents", category: "layout", exports: ["FeatureContents"] },
  { name: "ChatMessage", source: "custom", importPath: "@repo/ui/chat/chat-message", category: "ai", exports: ["ChatMessage", "MarkdownContent"] },
  { name: "ChatInput", source: "custom", importPath: "@repo/ui/components/chat/chat-input", category: "ai", exports: ["ChatInput"] },
];

@Injectable()
export class UiComponentResolverService {
  constructor(private readonly sessionService: SessionService) {}

  async resolve(
    input: ResolveUiComponentsDto,
    userId: string,
  ): Promise<{ components: ResolvedComponent[]; blocks: ResolvedBlock[]; imports: Array<{ from: string; names: string[] }> }> {
    await this.sessionService.verifySessionOwnership(input.sessionId, userId);

    const allComponents = [...SHADCN_COMPONENTS, ...CUSTOM_COMPONENTS];

    // Filter by hints if provided
    let filtered = allComponents;
    if (input.componentHints?.length) {
      const hints = input.componentHints.map((h) => h.toLowerCase());
      filtered = allComponents.filter((c) =>
        hints.some(
          (h) =>
            c.name.toLowerCase().includes(h) ||
            (c.category?.toLowerCase().includes(h) ?? false),
        ),
      );
    }

    // Build imports list
    const importMap = new Map<string, Set<string>>();
    for (const component of filtered) {
      const existing = importMap.get(component.importPath) ?? new Set();
      for (const exp of component.exports ?? [component.name]) {
        existing.add(exp);
      }
      importMap.set(component.importPath, existing);
    }

    const imports = Array.from(importMap.entries()).map(([from, names]) => ({
      from,
      names: Array.from(names),
    }));

    logger.info("UI components resolved", {
      "agent_desk.session_id": input.sessionId,
      "agent_desk.component_count": filtered.length,
    });

    return { components: filtered, blocks: [], imports };
  }
}
```

**Step 2: Update service/index.ts**

Add: `export { UiComponentResolverService } from "./ui-component-resolver.service";`

**Step 3: Verify**

Run: `cd packages/features && pnpm tsc --noEmit`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/features/agent-desk/service/ui-component-resolver.service.ts packages/features/agent-desk/service/index.ts
git commit -m "feat(agent-desk): add UiComponentResolverService for component resolution (FEA-149)"
```

---

## Task 6: Backend — Register Services in Module + tRPC Router + REST Controller

**Files:**
- Modify: `packages/features/agent-desk/agent-desk.module.ts`
- Modify: `packages/features/agent-desk/trpc/agent-desk.route.ts`
- Modify: `packages/features/agent-desk/controller/agent-desk.controller.ts`

**Step 1: Update Module**

Add `FlowAgentService`, `HandoffComposerService`, `UiComponentResolverService` to:
- `providers` array
- `exports` array
- Constructor injection
- `injectAgentDeskServices()` call

Also update the `createServiceContainer` generic type in `agent-desk.route.ts` to include the 3 new services:
```typescript
flowAgentService: FlowAgentService;
handoffComposerService: HandoffComposerService;
uiComponentResolverService: UiComponentResolverService;
```

**Step 2: Add tRPC procedures**

Add to `agentDeskRouter`:

```typescript
// ========================================
// Flow Agent (FRD-AD-218~224)
// ========================================

/** AI 에이전트에게 질문 — 구조화 질문 + 제안 카드 응답 */
askFlowAgent: authProcedure
  .input(askFlowAgentSchema)
  .mutation(async ({ input, ctx }) => {
    const userId = getAuthUserId(ctx);
    return services.get().flowAgentService.askFlowAgent(input, userId);
  }),

/** AI 제안 카드 적용/무시/수정 */
applyAiSuggestion: authProcedure
  .input(applyAiSuggestionSchema)
  .mutation(async ({ input, ctx }) => {
    const userId = getAuthUserId(ctx);
    return services.get().flowAgentService.applyAiSuggestion(input, userId);
  }),

// ========================================
// Implementation Handoff (FRD-AD-225)
// ========================================

/** 구현 인계 패키지 생성 */
generateImplementationHandoff: authProcedure
  .input(generateImplementationHandoffSchema)
  .mutation(async ({ input, ctx }) => {
    const userId = getAuthUserId(ctx);
    return services.get().handoffComposerService.generateHandoff(input, userId);
  }),

/** UI 컴포넌트 해석 */
resolveUiComponents: authProcedure
  .input(resolveUiComponentsSchema)
  .query(async ({ input, ctx }) => {
    const userId = getAuthUserId(ctx);
    return services.get().uiComponentResolverService.resolve(input, userId);
  }),
```

**Step 3: Add REST Controller endpoints**

Add 4 endpoints to `AgentDeskController`:

```typescript
// ============================================================================
// Flow Agent Endpoints (FRD-AD-218~224)
// ============================================================================

/** POST /api/agent-desk/agent/ask */
@Post("agent/ask")
@ApiOperation({ summary: "AI 에이전트에게 질문 (구조화 질문 + 제안 카드 응답)" })
@ApiResponse({ status: 200, description: "FlowAgentResponse 반환" })
async askFlowAgent(@CurrentUser() user: User, @Body() dto: AskFlowAgentDto) {
  return this.flowAgentService.askFlowAgent(dto, user.id);
}

/** POST /api/agent-desk/suggestions/:suggestionId/apply */
@Post("suggestions/:suggestionId/apply")
@ApiOperation({ summary: "AI 제안 카드 적용/무시/수정" })
@ApiParam({ name: "suggestionId", description: "제안 UUID" })
@ApiResponse({ status: 200, description: "적용 결과 반환" })
async applyAiSuggestion(
  @CurrentUser() user: User,
  @Param("suggestionId", ParseUUIDPipe) suggestionId: string,
  @Body() dto: ApplyAiSuggestionDto,
) {
  return this.flowAgentService.applyAiSuggestion({ ...dto, suggestionId }, user.id);
}

// ============================================================================
// Implementation Handoff Endpoints (FRD-AD-225)
// ============================================================================

/** POST /api/agent-desk/spec/implementation-handoff */
@Post("spec/implementation-handoff")
@ApiOperation({ summary: "구현 인계 패키지 생성" })
@ApiResponse({ status: 200, description: "ImplementationHandoff 반환" })
async generateImplementationHandoff(
  @CurrentUser() user: User,
  @Body() dto: GenerateImplementationHandoffDto,
) {
  return this.handoffComposerService.generateHandoff(dto, user.id);
}

/** GET /api/agent-desk/ui/components */
@Get("ui/components")
@ApiOperation({ summary: "사용 가능한 UI 컴포넌트 목록 조회" })
@ApiResponse({ status: 200, description: "컴포넌트/블록/import 목록 반환" })
async resolveUiComponents(@CurrentUser() user: User, @Query() dto: ResolveUiComponentsDto) {
  return this.uiComponentResolverService.resolve(dto, user.id);
}
```

**Step 4: Verify**

Run: `cd packages/features && pnpm tsc --noEmit`
Then: `cd apps/server && pnpm tsc --noEmit`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/features/agent-desk/agent-desk.module.ts packages/features/agent-desk/trpc/agent-desk.route.ts packages/features/agent-desk/controller/agent-desk.controller.ts
git commit -m "feat(agent-desk): register flow agent, handoff, UI resolver in module + tRPC + REST (FEA-149)"
```

---

## Task 7: Frontend Types & Hooks

**Files:**
- Modify: `apps/app/src/features/agent-desk/types/index.ts`
- Create: `apps/app/src/features/agent-desk/hooks/use-flow-agent.ts`
- Modify: `apps/app/src/features/agent-desk/hooks/index.ts`

**Step 1: Add frontend types**

Add to `apps/app/src/features/agent-desk/types/index.ts`:

```typescript
// AI Suggestion & Structured Question
export type SuggestionAction = "apply" | "ignore" | "modify";

export interface StructuredQuestion {
  id: string;
  slot: "role" | "goal" | "input" | "exception" | "branch";
  question: string;
  context?: string;
  targetScreenId?: string;
}

export interface AiSuggestion {
  id: string;
  type: "add_screen" | "remove_screen" | "update_screen" | "add_edge" | "update_edge" | "update_detail";
  title: string;
  description: string;
  previewData: Record<string, unknown>;
  affectedNodeIds: string[];
  status: "pending" | "applied" | "ignored";
}

export interface FlowAgentResponse {
  reply: string;
  questions: StructuredQuestion[];
  suggestions: AiSuggestion[];
}

// Implementation Handoff
export interface RouterMapEntry {
  screenId: string;
  screenName: string;
  routePath: string;
  parentRoute: string;
  authRule: "public" | "protected" | "admin";
}

export interface ScreenSpec {
  screenId: string;
  screenName: string;
  screenGoal: string;
  features: string[];
  uiDescription: string;
  states: string[];
  dataDependencies: string[];
}

export interface UiComponent {
  type: string;
  source: "shadcn" | "custom" | "layout" | "block";
  importPath: string;
  label?: string;
  props?: Record<string, unknown>;
  children?: UiComponent[];
  todoReason?: string;
}

export interface UiSpecSection {
  id: string;
  title: string;
  order: number;
  components: UiComponent[];
}

export interface UiSpec {
  screenId: string;
  layoutType: string;
  sections: UiSpecSection[];
  stateVariants: Record<string, Record<string, unknown>>;
  responsiveRules: Record<string, string>;
}

export interface NavigationRule {
  from: string;
  to: string;
  trigger: string;
  condition?: string;
  fallback?: string;
}

export interface ImplementationNote {
  category: "api" | "entity" | "validation" | "unresolved";
  content: string;
  todoReason?: string;
}

export interface HandoffArtifact {
  type: "spec_draft" | "mermaid" | "qa_mapping" | "source_trace";
  title: string;
  content: string;
}

export interface ImplementationHandoff {
  routerMap: RouterMapEntry[];
  screenSpecs: ScreenSpec[];
  uiSpecs: UiSpec[];
  navigationRules: NavigationRule[];
  implementationNotes: ImplementationNote[];
  artifacts: HandoffArtifact[];
}
```

**Step 2: Create hooks**

Create `apps/app/src/features/agent-desk/hooks/use-flow-agent.ts`:

```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";

export function useAskFlowAgent() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation({
    ...trpc.agentDesk.askFlowAgent.mutationOptions(),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: trpc.agentDesk.getMessages.queryKey({ sessionId: variables.sessionId }),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.agentDesk.getFlowData.queryKey({ sessionId: variables.sessionId }),
      });
    },
  });
}

export function useApplyAiSuggestion() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation({
    ...trpc.agentDesk.applyAiSuggestion.mutationOptions(),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: trpc.agentDesk.getFlowData.queryKey({ sessionId: variables.sessionId }),
      });
    },
  });
}

export function useGenerateImplementationHandoff() {
  const trpc = useTRPC();
  return useMutation(trpc.agentDesk.generateImplementationHandoff.mutationOptions());
}
```

**Step 3: Update hooks/index.ts**

Add:
```typescript
export { useAskFlowAgent, useApplyAiSuggestion, useGenerateImplementationHandoff } from "./use-flow-agent";
```

**Step 4: Verify**

Run: `cd apps/app && pnpm tsc --noEmit`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/app/src/features/agent-desk/types/index.ts apps/app/src/features/agent-desk/hooks/use-flow-agent.ts apps/app/src/features/agent-desk/hooks/index.ts
git commit -m "feat(agent-desk): add frontend types and hooks for flow agent and handoff (FEA-149)"
```

---

## Task 8: Frontend Component — SuggestionCard

**Files:**
- Create: `apps/app/src/features/agent-desk/components/suggestion-card.tsx`

**Step 1: Create SuggestionCard component**

A card that displays an AI suggestion with preview/apply/ignore actions (FRD-AD-218~219).

```typescript
import { useState } from "react";
import { Button } from "@repo/ui/shadcn/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/shadcn/card";
import { Badge } from "@repo/ui/shadcn/badge";
import { Check, Eye, X, Loader2 } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import type { AiSuggestion } from "../types";

interface Props {
  suggestion: AiSuggestion;
  onApply: (suggestionId: string) => void;
  onIgnore: (suggestionId: string) => void;
  onPreview: (suggestionId: string) => void;
  isApplying?: boolean;
  className?: string;
}

const TYPE_LABELS: Record<AiSuggestion["type"], string> = {
  add_screen: "화면 추가",
  remove_screen: "화면 삭제",
  update_screen: "화면 수정",
  add_edge: "전이 추가",
  update_edge: "전이 수정",
  update_detail: "상세 수정",
};

const TYPE_COLORS: Record<AiSuggestion["type"], string> = {
  add_screen: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  remove_screen: "bg-red-500/10 text-red-600 dark:text-red-400",
  update_screen: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  add_edge: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  update_edge: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  update_detail: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
};

export function SuggestionCard({ suggestion, onApply, onIgnore, onPreview, isApplying, className }: Props) {
  const isResolved = suggestion.status !== "pending";

  return (
    <Card className={cn(
      "border-primary/20 bg-primary/5 transition-all",
      isResolved && "opacity-60",
      className,
    )}>
      <CardHeader className="pb-2 pt-3 px-3">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="secondary" className={cn("text-xs font-normal", TYPE_COLORS[suggestion.type])}>
            {TYPE_LABELS[suggestion.type]}
          </Badge>
          {suggestion.status === "applied" ? (
            <Badge variant="outline" className="text-xs text-emerald-600">적용됨</Badge>
          ) : null}
          {suggestion.status === "ignored" ? (
            <Badge variant="outline" className="text-xs text-muted-foreground">무시됨</Badge>
          ) : null}
        </div>
        <CardTitle className="text-sm font-medium mt-1">{suggestion.title}</CardTitle>
        <CardDescription className="text-xs">{suggestion.description}</CardDescription>
      </CardHeader>
      {!isResolved ? (
        <CardContent className="px-3 pb-3 pt-0">
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onPreview(suggestion.id)}
            >
              <Eye className="mr-1 size-3" />
              미리보기
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={() => onApply(suggestion.id)}
              disabled={isApplying}
            >
              {isApplying ? (
                <Loader2 className="mr-1 size-3 animate-spin" />
              ) : (
                <Check className="mr-1 size-3" />
              )}
              적용
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => onIgnore(suggestion.id)}
            >
              <X className="mr-1 size-3" />
              무시
            </Button>
          </div>
        </CardContent>
      ) : null}
    </Card>
  );
}
```

**Step 2: Verify**

Run: `cd apps/app && pnpm tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/app/src/features/agent-desk/components/suggestion-card.tsx
git commit -m "feat(agent-desk): add SuggestionCard component with preview/apply/ignore actions (FEA-149)"
```

---

## Task 9: Frontend Component — HandoffViewer

**Files:**
- Create: `apps/app/src/features/agent-desk/components/handoff-viewer.tsx`

**Step 1: Create HandoffViewer component**

A dialog that displays the implementation handoff package with tabs for each section.

```typescript
import { Badge } from "@repo/ui/shadcn/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/shadcn/card";
import { ScrollArea } from "@repo/ui/shadcn/scroll-area";
import { Separator } from "@repo/ui/shadcn/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/shadcn/tabs";
import { MarkdownContent } from "@repo/ui/chat/chat-message";
import { Code, FileText, GitBranch, Map, Route } from "lucide-react";
import type { ImplementationHandoff } from "../types";

interface Props {
  handoff: ImplementationHandoff;
}

export function HandoffViewer({ handoff }: Props) {
  return (
    <Tabs defaultValue="router" className="h-full flex flex-col">
      <TabsList className="grid w-full grid-cols-5 mb-2">
        <TabsTrigger value="router" className="text-xs">
          <Route className="mr-1 size-3" />
          라우터
        </TabsTrigger>
        <TabsTrigger value="screens" className="text-xs">
          <Map className="mr-1 size-3" />
          화면 스펙
        </TabsTrigger>
        <TabsTrigger value="ui" className="text-xs">
          <Code className="mr-1 size-3" />
          UI 스펙
        </TabsTrigger>
        <TabsTrigger value="nav" className="text-xs">
          <GitBranch className="mr-1 size-3" />
          이동 규칙
        </TabsTrigger>
        <TabsTrigger value="artifacts" className="text-xs">
          <FileText className="mr-1 size-3" />
          산출물
        </TabsTrigger>
      </TabsList>

      <ScrollArea className="flex-1">
        <TabsContent value="router" className="mt-0 space-y-2">
          {handoff.routerMap.map((entry) => (
            <Card key={entry.screenId} className="bg-muted/30">
              <CardHeader className="py-2 px-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{entry.screenName}</CardTitle>
                  <Badge variant="outline" className="text-xs">{entry.authRule}</Badge>
                </div>
              </CardHeader>
              <CardContent className="px-3 pb-2 text-xs text-muted-foreground space-y-0.5">
                <p>경로: <code className="text-foreground">{entry.routePath}</code></p>
                <p>부모: <code className="text-foreground">{entry.parentRoute}</code></p>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="screens" className="mt-0 space-y-2">
          {handoff.screenSpecs.map((spec) => (
            <Card key={spec.screenId} className="bg-muted/30">
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-sm">{spec.screenName}</CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-2 text-xs space-y-1">
                <p className="text-muted-foreground">{spec.screenGoal}</p>
                {spec.features.length > 0 ? (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {spec.features.map((f, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{f}</Badge>
                    ))}
                  </div>
                ) : null}
                {spec.states.length > 0 ? (
                  <p className="text-muted-foreground">상태: {spec.states.join(", ")}</p>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="ui" className="mt-0 space-y-2">
          {handoff.uiSpecs.length > 0 ? (
            handoff.uiSpecs.map((spec) => (
              <Card key={spec.screenId} className="bg-muted/30">
                <CardHeader className="py-2 px-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{spec.screenId}</CardTitle>
                    <Badge variant="outline" className="text-xs">{spec.layoutType}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="px-3 pb-2 text-xs space-y-1">
                  {spec.sections.map((section) => (
                    <div key={section.id}>
                      <p className="font-medium">{section.title}</p>
                      <div className="pl-2 text-muted-foreground">
                        {section.components.map((c, i) => (
                          <p key={i}>
                            <code>{c.type}</code>
                            <span className="ml-1">({c.source})</span>
                            {c.todoReason ? <Badge variant="destructive" className="ml-1 text-[10px]">TODO</Badge> : null}
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))
          ) : (
            <p className="text-xs text-muted-foreground py-4 text-center">UI 스펙이 없습니다</p>
          )}
        </TabsContent>

        <TabsContent value="nav" className="mt-0 space-y-2">
          {handoff.navigationRules.map((rule, i) => (
            <Card key={i} className="bg-muted/30">
              <CardContent className="py-2 px-3 text-xs">
                <p className="font-medium">{rule.from} → {rule.to}</p>
                <p className="text-muted-foreground">트리거: {rule.trigger}</p>
                {rule.condition ? <p className="text-muted-foreground">조건: {rule.condition}</p> : null}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="artifacts" className="mt-0 space-y-2">
          {handoff.artifacts.map((artifact, i) => (
            <Card key={i} className="bg-muted/30">
              <CardHeader className="py-2 px-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{artifact.title}</CardTitle>
                  <Badge variant="outline" className="text-xs">{artifact.type}</Badge>
                </div>
              </CardHeader>
              <CardContent className="px-3 pb-2">
                {artifact.type === "mermaid" ? (
                  <pre className="text-xs bg-muted rounded p-2 overflow-x-auto">{artifact.content}</pre>
                ) : (
                  <div className="prose prose-xs max-w-none dark:prose-invert">
                    <MarkdownContent content={artifact.content} />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {handoff.implementationNotes.length > 0 ? (
            <>
              <Separator className="my-2" />
              <p className="text-xs font-medium px-1">구현 메모</p>
              {handoff.implementationNotes.map((note, i) => (
                <Card key={i} className="bg-muted/30">
                  <CardContent className="py-2 px-3 text-xs">
                    <Badge variant={note.category === "unresolved" ? "destructive" : "secondary"} className="text-xs mb-1">
                      {note.category}
                    </Badge>
                    <p>{note.content}</p>
                    {note.todoReason ? <p className="text-muted-foreground italic">TODO: {note.todoReason}</p> : null}
                  </CardContent>
                </Card>
              ))}
            </>
          ) : null}
        </TabsContent>
      </ScrollArea>
    </Tabs>
  );
}
```

**Step 2: Verify**

Run: `cd apps/app && pnpm tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/app/src/features/agent-desk/components/handoff-viewer.tsx
git commit -m "feat(agent-desk): add HandoffViewer component with tabbed display (FEA-149)"
```

---

## Task 10: Frontend — Integrate into FlowDesigner Page

**Files:**
- Modify: `apps/app/src/features/agent-desk/pages/flow-designer.tsx`

**Step 1: Add suggestion cards and handoff dialog**

Key changes to `flow-designer.tsx`:

1. Import new hooks: `useAskFlowAgent`, `useApplyAiSuggestion`, `useGenerateImplementationHandoff`
2. Import new components: `SuggestionCard`, `HandoffViewer`
3. Add state for suggestions: `const [suggestions, setSuggestions] = useState<AiSuggestion[]>([])`
4. Add state for handoff dialog: `const [handoff, setHandoff] = useState<ImplementationHandoff | null>(null)`, `const [isHandoffOpen, setIsHandoffOpen] = useState(false)`
5. Modify `handleSend` to use `askFlowAgent` instead of `streamChat` when suggestions are desired
6. Render suggestion cards after agent messages in the chat panel
7. Add "구현 인계 생성" button in the header
8. Add HandoffViewer dialog

The chat panel should display:
- Normal messages as before
- Suggestion cards inline after agent responses that contain suggestions
- A "구현 인계 생성" button that opens the handoff viewer dialog

**Step 2: Verify**

Run: `cd apps/app && pnpm tsc --noEmit`
Expected: PASS

**Step 3: Runtime Verify**

- Navigate to `/agent-desk/{sessionId}/designer` for an operator session
- Send a message using the chat input
- Verify suggestion cards appear if the AI responds with suggestions
- Click "구현 인계 생성" button
- Verify the handoff viewer dialog opens with tabbed content

**Step 4: Commit**

```bash
git add apps/app/src/features/agent-desk/pages/flow-designer.tsx
git commit -m "feat(agent-desk): integrate suggestion cards and handoff viewer into FlowDesigner (FEA-149)"
```

---

## Task 11: Unit Tests — FlowAgentService

**Files:**
- Create: `packages/features/agent-desk/service/flow-agent.service.spec.ts`

Follow the testing patterns from `packages/features/__test-utils__/`:
- Mock `drizzle-orm`, `@repo/drizzle`, `@repo/core/logger`
- Use `createMockDb()` and NestJS `TestingModule`
- Test `askFlowAgent` (success + error cases)
- Test `applyAiSuggestion` (apply, ignore, not found cases)

Run: `pnpm -F @repo/features test -- --testPathPattern="flow-agent"`
Expected: All tests PASS

**Commit:**
```bash
git commit -m "test(agent-desk): add FlowAgentService unit tests (FEA-149)"
```

---

## Task 12: Unit Tests — HandoffComposerService

**Files:**
- Create: `packages/features/agent-desk/service/handoff-composer.service.spec.ts`

Test `generateHandoff`:
- Success case with LLM response
- Fallback case when LLM response is invalid
- Session not found case
- Empty screens case

Run: `pnpm -F @repo/features test -- --testPathPattern="handoff-composer"`
Expected: All tests PASS

**Commit:**
```bash
git commit -m "test(agent-desk): add HandoffComposerService unit tests (FEA-149)"
```

---

## Task 13: Reference Docs Update

**Files:**
- Modify: `docs/reference/features-backend.md`
- Modify: `docs/reference/features-frontend.md`

Update backend reference with:
- FlowAgentService, HandoffComposerService, UiComponentResolverService
- 4 new tRPC procedures
- 4 new REST endpoints

Update frontend reference with:
- New hooks: useAskFlowAgent, useApplyAiSuggestion, useGenerateImplementationHandoff
- New components: SuggestionCard, HandoffViewer
- New types

**Commit:**
```bash
git commit -m "docs(agent-desk): update reference docs for FEA-149 agent collaboration and handoff"
```

---

## Task 14: Runtime Verification & Final Build Check

**Step 1: Full build check**

```bash
cd apps/server && pnpm tsc --noEmit
cd apps/app && pnpm tsc --noEmit
cd packages/features && pnpm tsc --noEmit
```

**Step 2: Run all agent-desk tests**

```bash
pnpm -F @repo/features test -- --testPathPattern="agent-desk"
```

**Step 3: Server API verification**

Start server, then test:
```bash
# askFlowAgent
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3002/api/agent-desk/agent/ask -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"sessionId":"...","message":"테스트"}'

# resolveUiComponents
curl -s -o /dev/null -w "%{http_code}" "http://localhost:3002/api/agent-desk/ui/components?sessionId=..."  -H "Authorization: Bearer $TOKEN"
```

**Step 4: Browser verification**

Navigate to flow designer page, test:
- AI agent chat with suggestion cards
- Suggestion preview/apply/ignore
- Implementation handoff generation and viewer

**Commit:** Final verification commit if needed.
