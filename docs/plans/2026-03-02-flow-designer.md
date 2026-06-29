# Flow Designer 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 에이전트 데스크에 "designer" 세션 타입을 추가하여, AI 대화 기반으로 모바일/데스크탑 웹앱의 화면 흐름을 정의하고 화면정의서 초안을 생성하는 3칸 분할 위자드를 구현한다.

**Architecture:** 기존 에이전트 데스크의 세션/채팅/파일 인프라를 재활용하고, DB 스키마(enum + 컬럼 확장), 서버(FlowDesignerService + 프롬프트), 클라이언트(3칸 레이아웃 + 전용 hooks)를 추가한다. 기존 코드를 수정하는 부분(enum 확장, DTO 변경)과 신규 파일 생성을 명확히 구분한다.

**Tech Stack:** Drizzle ORM (PostgreSQL), NestJS, tRPC, React 19, TanStack Router/Query, Jotai, Mermaid, Tailwind CSS

**Design Doc:** `docs/plans/2026-03-02-flow-designer-design.md`

---

## Task 1: DB 스키마 확장 — enum + 컬럼 추가

**Files:**
- Modify: `packages/drizzle/src/schema/features/agent-desk/index.ts`

**Step 1: enum에 "designer" 타입 추가**

`agentDeskSessionTypeEnum`에 `"designer"` 추가:

```typescript
export const agentDeskSessionTypeEnum = pgEnum("agent_desk_session_type", ["customer", "operator", "designer"]);
```

**Step 2: enum에 "designing" 상태 추가**

`agentDeskSessionStatusEnum`에 `"designing"` 추가 (`"uploading"` 다음):

```typescript
export const agentDeskSessionStatusEnum = pgEnum("agent_desk_session_status", [
  "uploading",
  "parsing",
  "designing",
  "analyzing",
  "analyzed",
  "reviewed",
  "spec_generated",
  "project_created",
  "executing",
  "executed",
  "failed",
]);
```

**Step 3: 세션 테이블에 컬럼 추가**

`agentDeskSessions` 테이블에 3개 컬럼 추가:

```typescript
export const agentDeskSessions = pgTable("agent_desk_sessions", {
  ...baseColumns(),
  type: agentDeskSessionTypeEnum("type").notNull(),
  status: agentDeskSessionStatusEnum("status").notNull().default("uploading"),
  title: varchar("title", { length: 200 }),
  prompt: text("prompt"),
  analysisResult: jsonb("analysis_result"),
  diagrams: jsonb("diagrams"),
  spec: text("spec"),
  errorMessage: text("error_message"),
  // --- Flow Designer 전용 컬럼 ---
  platform: varchar("platform", { length: 20 }),    // "mobile" | "desktop"
  designTheme: text("design_theme"),                 // 디자인 테마/스타일 텍스트
  flowData: jsonb("flow_data"),                      // FlowData JSONB
  createdById: uuid("created_by_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
});
```

**Step 4: 마이그레이션 생성**

Run: `cd packages/drizzle && pnpm drizzle-kit generate`
Expected: 마이그레이션 파일 생성 (enum 값 추가 + 3개 컬럼 추가)

**Step 5: 마이그레이션 적용**

Run: `cd packages/drizzle && pnpm drizzle-kit push`
Expected: DB에 변경사항 적용

**Step 6: 커밋**

```bash
git add packages/drizzle/
git commit -m "feat(agent-desk): add designer session type and flow data columns"
```

---

## Task 2: 클라이언트 타입 확장

**Files:**
- Modify: `apps/app/src/features/agent-desk/types/index.ts`

**Step 1: SessionType에 "designer" 추가**

```typescript
export type SessionType = "customer" | "operator" | "designer";
```

**Step 2: SessionStatus에 "designing" 추가**

```typescript
export type SessionStatus =
  | "uploading"
  | "parsing"
  | "designing"
  | "analyzing"
  // ... 나머지 동일
```

**Step 3: FlowData 타입 추가**

파일 하단에 추가:

```typescript
export interface FlowScreen {
  id: string;
  name: string;
  order: number;
  description: string;
  wireframeType: string;
  wireframeMermaid: string;
  nextScreenIds: string[];
  metadata: Record<string, unknown>;
}

export interface FlowData {
  screens: FlowScreen[];
  currentScreenIndex: number;
}

export interface FlowDesignResult {
  platform: "mobile" | "desktop";
  designTheme: string;
  screens: FlowScreen[];
  flowchartMermaid: string;
  screenDefinitionDraft: string;
}
```

**Step 4: 커밋**

```bash
git add apps/app/src/features/agent-desk/types/
git commit -m "feat(agent-desk): add flow designer types"
```

---

## Task 3: DTO 확장 — createSession에 designer 필드 추가

**Files:**
- Modify: `packages/features/agent-desk/dto/create-session.dto.ts`
- Create: `packages/features/agent-desk/dto/flow-designer.dto.ts`

**Step 1: createSessionSchema에 designer 추가**

```typescript
export const createSessionSchema = z.object({
  type: z.enum(["customer", "operator", "designer"]).describe("세션 유형"),
  title: z.string().max(200).optional().describe("세션 제목"),
  prompt: z.string().optional().describe("초기 프롬프트"),
  platform: z.enum(["mobile", "desktop"]).optional().describe("플랫폼 (designer 전용)"),
  designTheme: z.string().optional().describe("디자인 테마/스타일 (designer 전용)"),
});
```

**Step 2: flow-designer.dto.ts 생성**

```typescript
import { z } from "zod";

export const flowScreenSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  order: z.number().int().min(0),
  description: z.string().default(""),
  wireframeType: z.string().default(""),
  wireframeMermaid: z.string().default(""),
  nextScreenIds: z.array(z.string().uuid()).default([]),
  metadata: z.record(z.unknown()).default({}),
});

export const updateFlowDataSchema = z.object({
  sessionId: z.string().uuid().describe("세션 ID"),
  flowData: z.object({
    screens: z.array(flowScreenSchema),
    currentScreenIndex: z.number().int().min(0),
  }).describe("화면 흐름 데이터"),
});

export const updateDesignerSettingsSchema = z.object({
  sessionId: z.string().uuid().describe("세션 ID"),
  platform: z.enum(["mobile", "desktop"]).optional().describe("플랫폼"),
  designTheme: z.string().optional().describe("디자인 테마"),
});

export const addScreenSchema = z.object({
  sessionId: z.string().uuid().describe("세션 ID"),
  name: z.string().min(1).max(100).describe("화면 이름"),
  afterScreenId: z.string().uuid().optional().describe("이 화면 뒤에 추가 (미지정 시 마지막)"),
});

export const updateScreenSchema = z.object({
  sessionId: z.string().uuid().describe("세션 ID"),
  screenId: z.string().uuid().describe("화면 ID"),
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  wireframeType: z.string().optional(),
  wireframeMermaid: z.string().optional(),
  nextScreenIds: z.array(z.string().uuid()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const removeScreenSchema = z.object({
  sessionId: z.string().uuid().describe("세션 ID"),
  screenId: z.string().uuid().describe("삭제할 화면 ID"),
});

export const completeFlowDesignSchema = z.object({
  sessionId: z.string().uuid().describe("세션 ID"),
  model: z.string().optional().describe("화면정의서 생성 시 사용할 LLM 모델"),
});

export type UpdateFlowDataDto = z.infer<typeof updateFlowDataSchema>;
export type UpdateDesignerSettingsDto = z.infer<typeof updateDesignerSettingsSchema>;
export type AddScreenDto = z.infer<typeof addScreenSchema>;
export type UpdateScreenDto = z.infer<typeof updateScreenSchema>;
export type RemoveScreenDto = z.infer<typeof removeScreenSchema>;
export type CompleteFlowDesignDto = z.infer<typeof completeFlowDesignSchema>;
```

**Step 3: dto/index.ts에 export 추가**

기존 dto/index.ts를 확인하고 `export * from "./flow-designer.dto";` 추가.

**Step 4: 커밋**

```bash
git add packages/features/agent-desk/dto/
git commit -m "feat(agent-desk): add flow designer DTOs"
```

---

## Task 4: 서버 — FlowDesignerService 구현

**Files:**
- Create: `packages/features/agent-desk/service/flow-designer.service.ts`
- Modify: `packages/features/agent-desk/service/index.ts` (re-export 추가)

**Step 1: FlowDesignerService 작성**

`packages/features/agent-desk/service/flow-designer.service.ts`:

```typescript
import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { InjectDrizzle, type DrizzleDB } from "@repo/drizzle";
import { agentDeskSessions } from "@repo/drizzle";
import { createLogger } from "@repo/core/logger";
import { LLMService } from "@repo/features/ai";
import { randomUUID } from "crypto";

const logger = createLogger("agent-desk");

interface FlowScreen {
  id: string;
  name: string;
  order: number;
  description: string;
  wireframeType: string;
  wireframeMermaid: string;
  nextScreenIds: string[];
  metadata: Record<string, unknown>;
}

interface FlowData {
  screens: FlowScreen[];
  currentScreenIndex: number;
}

@Injectable()
export class FlowDesignerService {
  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly llmService: LLMService,
  ) {}

  /** 세션의 flowData를 조회한다 */
  async getFlowData(sessionId: string): Promise<FlowData> {
    const session = await this.db.query.agentDeskSessions.findFirst({
      where: eq(agentDeskSessions.id, sessionId),
      columns: { id: true, type: true, flowData: true },
    });

    if (!session) throw new NotFoundException(`Session not found: ${sessionId}`);
    if (session.type !== "designer") throw new BadRequestException("Not a designer session");

    return (session.flowData as FlowData) ?? { screens: [], currentScreenIndex: 0 };
  }

  /** 새 화면을 추가한다 */
  async addScreen(sessionId: string, name: string, afterScreenId?: string): Promise<FlowData> {
    const flowData = await this.getFlowData(sessionId);

    const newScreen: FlowScreen = {
      id: randomUUID(),
      name,
      order: flowData.screens.length,
      description: "",
      wireframeType: "",
      wireframeMermaid: "",
      nextScreenIds: [],
      metadata: {},
    };

    if (afterScreenId) {
      const idx = flowData.screens.findIndex((s) => s.id === afterScreenId);
      if (idx === -1) throw new BadRequestException(`Screen not found: ${afterScreenId}`);
      flowData.screens.splice(idx + 1, 0, newScreen);
      // 이전 화면의 nextScreenIds에 연결
      flowData.screens[idx].nextScreenIds.push(newScreen.id);
    } else {
      // 마지막 화면이 있으면 nextScreenIds 연결
      if (flowData.screens.length > 0) {
        flowData.screens[flowData.screens.length - 1].nextScreenIds.push(newScreen.id);
      }
      flowData.screens.push(newScreen);
    }

    // order 재정렬
    flowData.screens.forEach((s, i) => { s.order = i; });
    flowData.currentScreenIndex = flowData.screens.findIndex((s) => s.id === newScreen.id);

    await this.saveFlowData(sessionId, flowData);

    logger.info("Screen added", {
      "agent-desk.session_id": sessionId,
      "agent-desk.screen_id": newScreen.id,
      "agent-desk.screen_name": name,
    });

    return flowData;
  }

  /** 화면 정보를 업데이트한다 */
  async updateScreen(
    sessionId: string,
    screenId: string,
    updates: Partial<Omit<FlowScreen, "id" | "order">>,
  ): Promise<FlowData> {
    const flowData = await this.getFlowData(sessionId);
    const screen = flowData.screens.find((s) => s.id === screenId);
    if (!screen) throw new NotFoundException(`Screen not found: ${screenId}`);

    Object.assign(screen, updates);
    await this.saveFlowData(sessionId, flowData);

    logger.info("Screen updated", {
      "agent-desk.session_id": sessionId,
      "agent-desk.screen_id": screenId,
    });

    return flowData;
  }

  /** 화면을 삭제한다 */
  async removeScreen(sessionId: string, screenId: string): Promise<FlowData> {
    const flowData = await this.getFlowData(sessionId);
    const idx = flowData.screens.findIndex((s) => s.id === screenId);
    if (idx === -1) throw new NotFoundException(`Screen not found: ${screenId}`);

    flowData.screens.splice(idx, 1);
    // 다른 화면의 nextScreenIds에서 제거
    for (const screen of flowData.screens) {
      screen.nextScreenIds = screen.nextScreenIds.filter((id) => id !== screenId);
    }
    // order 재정렬
    flowData.screens.forEach((s, i) => { s.order = i; });
    // currentScreenIndex 조정
    if (flowData.currentScreenIndex >= flowData.screens.length) {
      flowData.currentScreenIndex = Math.max(0, flowData.screens.length - 1);
    }

    await this.saveFlowData(sessionId, flowData);

    logger.info("Screen removed", {
      "agent-desk.session_id": sessionId,
      "agent-desk.screen_id": screenId,
    });

    return flowData;
  }

  /** 디자이너 설정(플랫폼/테마)을 업데이트한다 */
  async updateSettings(
    sessionId: string,
    settings: { platform?: string; designTheme?: string },
  ): Promise<void> {
    await this.db.update(agentDeskSessions).set(settings).where(eq(agentDeskSessions.id, sessionId));
  }

  /** 전체 flowData를 저장한다 */
  async saveFlowData(sessionId: string, flowData: FlowData): Promise<void> {
    await this.db.update(agentDeskSessions).set({ flowData }).where(eq(agentDeskSessions.id, sessionId));
  }

  /** 전체 플로우차트 Mermaid 코드를 생성한다 */
  generateFlowchartMermaid(flowData: FlowData): string {
    if (flowData.screens.length === 0) return "graph TD\n  empty[화면 없음]";

    const lines = ["graph TD"];
    for (const screen of flowData.screens) {
      const nodeId = `s_${screen.order}`;
      lines.push(`  ${nodeId}["${screen.name}"]`);
    }
    for (const screen of flowData.screens) {
      const fromId = `s_${screen.order}`;
      for (const nextId of screen.nextScreenIds) {
        const nextScreen = flowData.screens.find((s) => s.id === nextId);
        if (nextScreen) {
          lines.push(`  ${fromId} --> s_${nextScreen.order}`);
        }
      }
    }
    return lines.join("\n");
  }

  /** 완료: 화면정의서 초안을 LLM으로 생성한다 */
  async completeDesign(sessionId: string, model?: string): Promise<string> {
    const session = await this.db.query.agentDeskSessions.findFirst({
      where: eq(agentDeskSessions.id, sessionId),
    });
    if (!session) throw new NotFoundException(`Session not found: ${sessionId}`);

    const flowData = (session.flowData as FlowData) ?? { screens: [], currentScreenIndex: 0 };
    const flowchartMermaid = this.generateFlowchartMermaid(flowData);

    const prompt = this.buildScreenDefinitionPrompt(session, flowData, flowchartMermaid);
    const draft = await this.llmService.generateText(prompt, model);

    // 세션 업데이트: 상태를 analyzed로, 분석 결과에 화면정의서 저장
    await this.db.update(agentDeskSessions).set({
      status: "analyzed",
      spec: draft,
      diagrams: [{ type: "flowchart", title: "화면 흐름도", description: "전체 화면 연결 구조", mermaidCode: flowchartMermaid }],
    }).where(eq(agentDeskSessions.id, sessionId));

    logger.info("Flow design completed", {
      "agent-desk.session_id": sessionId,
      "agent-desk.screen_count": flowData.screens.length,
    });

    return draft;
  }

  private buildScreenDefinitionPrompt(
    session: any,
    flowData: FlowData,
    flowchartMermaid: string,
  ): string {
    const screenDetails = flowData.screens.map((s, i) => `
### ${i + 1}. ${s.name}
- **와이어프레임 타입**: ${s.wireframeType || "미정"}
- **설명**: ${s.description || "미입력"}
- **다음 화면**: ${s.nextScreenIds.length > 0 ? s.nextScreenIds.map((id) => flowData.screens.find((sc) => sc.id === id)?.name).filter(Boolean).join(", ") : "없음 (종료)"}
- **상세 메타데이터**: ${JSON.stringify(s.metadata)}
`).join("\n");

    return `아래 화면 흐름 정보를 바탕으로 화면정의서 초안을 Markdown으로 작성해주세요.

## 프로젝트 정보
- 플랫폼: ${session.platform ?? "미정"}
- 디자인 테마: ${session.designTheme ?? "미정"}
- 제목: ${session.title ?? "무제"}

## 전체 플로우차트
\`\`\`mermaid
${flowchartMermaid}
\`\`\`

## 화면 상세
${screenDetails}

## 요청사항
각 화면에 대해 다음을 포함하여 화면정의서 초안을 작성하세요:
1. 화면 이름, 경로, 목적
2. 주요 UI 요소 (헤더, 콘텐츠, 버튼 등)
3. 사용자 인터랙션 (클릭, 입력, 스와이프 등)
4. 다음 화면 연결 (조건 포함)
5. 에러/예외 상태
6. 와이어프레임 설명

Markdown 테이블과 Mermaid 다이어그램을 활용하여 구조화해주세요.`;
  }
}
```

**Step 2: service/index.ts에 export 추가**

기존 `packages/features/agent-desk/service/index.ts`에 추가:
```typescript
export { FlowDesignerService } from "./flow-designer.service";
```

**Step 3: 커밋**

```bash
git add packages/features/agent-desk/service/
git commit -m "feat(agent-desk): add FlowDesignerService for screen flow management"
```

---

## Task 5: 서버 — 프롬프트 + 모듈 확장

**Files:**
- Modify: `packages/features/agent-desk/prompts/index.ts`
- Modify: `packages/features/agent-desk/agent-desk.module.ts`

**Step 1: designer 전용 프롬프트 추가**

`packages/features/agent-desk/prompts/index.ts` 파일 하단에 추가:

```typescript
export const DESIGNER_SYSTEM_PROMPT = `당신은 Product Builder의 화면 흐름 설계 도우미 에이전트입니다.

## 역할
- 사용자가 만들고 싶은 웹앱의 각 화면을 하나씩 정의하도록 안내합니다.
- 화면의 목적, UI 요소, 인터랙션, 다음 화면 연결을 체계적으로 수집합니다.
- 수집된 정보를 바탕으로 와이어프레임 구조를 제안합니다.

## 대화 가이드
1. 현재 정의 중인 화면에 대해 질문합니다.
2. 한 번에 하나의 질문만 합니다.
3. 화면의 목적 → UI 요소 → 인터랙션 → 다음 화면 순서로 진행합니다.
4. 충분한 정보가 모이면 요약하고, 다음 화면으로 넘어갈지 물어봅니다.
5. 파일이 업로드되면 참고하여 화면 설계에 반영합니다.

## 응답 규칙
- 한국어로 응답합니다.
- 간결하고 구조화된 응답을 합니다.
- 한 번에 하나의 질문만 합니다.
- 와이어프레임 제안 시 간단한 텍스트 레이아웃으로 표현합니다.

## 화면 전환 시 자동 메시지
새 화면으로 전환되면 다음과 같이 시작합니다:
"[화면명] 화면을 정의합니다. 이 화면의 주요 목적과 기능을 알려주세요."

## 컨텍스트 활용
이전에 정의된 화면 정보가 제공됩니다. 이를 참고하여:
- 일관된 네비게이션 구조를 유지합니다.
- 이전 화면과의 연결을 자연스럽게 제안합니다.
- 중복된 UI 요소를 식별하고 공통 컴포넌트를 제안합니다.`;

export const DESIGNER_WELCOME = "안녕하세요! 웹앱의 화면 흐름을 함께 설계하겠습니다. 먼저 첫 번째 화면의 이름과 목적을 알려주세요. (예: '홈 화면 - 메인 진입점')";
```

**Step 2: Module에 FlowDesignerService 추가**

`packages/features/agent-desk/agent-desk.module.ts`에서:
- import 추가: `import { FlowDesignerService } from "./service";`
- providers 배열에 `FlowDesignerService` 추가
- exports 배열에 `FlowDesignerService` 추가
- constructor에 `private readonly flowDesignerService: FlowDesignerService` 추가
- `injectAgentDeskServices`에 `flowDesignerService: this.flowDesignerService` 추가

**Step 3: 커밋**

```bash
git add packages/features/agent-desk/prompts/ packages/features/agent-desk/agent-desk.module.ts
git commit -m "feat(agent-desk): add designer prompt and register FlowDesignerService"
```

---

## Task 6: 서버 — tRPC 라우터에 flow designer 프로시저 추가

**Files:**
- Modify: `packages/features/agent-desk/trpc/agent-desk.route.ts`

**Step 1: tRPC 라우터에 flow designer 프로시저 추가**

기존 라우터의 `agentDeskRouter = router({...})` 내부에 아래 프로시저 추가:

```typescript
// Flow Designer
getFlowData: protectedProcedure
  .input(z.object({ sessionId: z.string().uuid() }))
  .query(async ({ input }) => {
    return services.get("flowDesignerService").getFlowData(input.sessionId);
  }),

addScreen: protectedProcedure
  .input(addScreenSchema)
  .mutation(async ({ input }) => {
    return services.get("flowDesignerService").addScreen(input.sessionId, input.name, input.afterScreenId);
  }),

updateScreen: protectedProcedure
  .input(updateScreenSchema)
  .mutation(async ({ input }) => {
    const { sessionId, screenId, ...updates } = input;
    return services.get("flowDesignerService").updateScreen(sessionId, screenId, updates);
  }),

removeScreen: protectedProcedure
  .input(removeScreenSchema)
  .mutation(async ({ input }) => {
    return services.get("flowDesignerService").removeScreen(input.sessionId, input.screenId);
  }),

updateDesignerSettings: protectedProcedure
  .input(updateDesignerSettingsSchema)
  .mutation(async ({ input }) => {
    const { sessionId, ...settings } = input;
    await services.get("flowDesignerService").updateSettings(sessionId, settings);
    return { success: true };
  }),

saveFlowData: protectedProcedure
  .input(updateFlowDataSchema)
  .mutation(async ({ input }) => {
    await services.get("flowDesignerService").saveFlowData(input.sessionId, input.flowData);
    return { success: true };
  }),

completeFlowDesign: protectedProcedure
  .input(completeFlowDesignSchema)
  .mutation(async ({ input }) => {
    const draft = await services.get("flowDesignerService").completeDesign(input.sessionId, input.model);
    return { draft };
  }),
```

필요한 import 추가:
```typescript
import {
  addScreenSchema,
  updateScreenSchema,
  removeScreenSchema,
  updateDesignerSettingsSchema,
  updateFlowDataSchema,
  completeFlowDesignSchema,
} from "../dto/flow-designer.dto";
```

Service container의 타입에 `flowDesignerService: FlowDesignerService` 추가.

**Step 2: 커밋**

```bash
git add packages/features/agent-desk/trpc/
git commit -m "feat(agent-desk): add flow designer tRPC procedures"
```

---

## Task 7: 서버 — REST Controller에 flow designer 엔드포인트 추가

**Files:**
- Modify: `packages/features/agent-desk/controller/agent-desk.controller.ts`

**Step 1: REST 엔드포인트 추가**

기존 컨트롤러에 Flow Designer 관련 엔드포인트 추가:

```typescript
@Get("flow/:sessionId")
@ApiOperation({ summary: "화면 흐름 데이터 조회" })
@ApiParam({ name: "sessionId", description: "세션 ID" })
@ApiResponse({ status: 200, description: "FlowData 반환" })
async getFlowData(@Param("sessionId", ParseUUIDPipe) sessionId: string) {
  return this.flowDesignerService.getFlowData(sessionId);
}

@Post("flow/:sessionId/screens")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiOperation({ summary: "새 화면 추가" })
async addScreen(
  @Param("sessionId", ParseUUIDPipe) sessionId: string,
  @Body() dto: { name: string; afterScreenId?: string },
) {
  return this.flowDesignerService.addScreen(sessionId, dto.name, dto.afterScreenId);
}

@Post("flow/:sessionId/complete")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiOperation({ summary: "화면 흐름 설계 완료 — 화면정의서 생성" })
async completeFlowDesign(
  @Param("sessionId", ParseUUIDPipe) sessionId: string,
  @Body() dto: { model?: string },
) {
  const draft = await this.flowDesignerService.completeDesign(sessionId, dto.model);
  return { draft };
}
```

Controller constructor에 `private readonly flowDesignerService: FlowDesignerService` 추가.

**Step 2: 커밋**

```bash
git add packages/features/agent-desk/controller/
git commit -m "feat(agent-desk): add flow designer REST endpoints"
```

---

## Task 8: 서버 — SessionService 수정 (designer 세션 생성 지원)

**Files:**
- Modify: `packages/features/agent-desk/service/session.service.ts`

**Step 1: createSession에서 designer 타입 처리**

기존 `createSession` 메서드에서 type이 `"designer"`일 때 추가 처리:
- `platform`, `designTheme` 컬럼 저장
- 초기 `flowData` 설정: `{ screens: [], currentScreenIndex: 0 }`
- 초기 상태: `"designing"` (uploading 대신)
- 환영 메시지: `DESIGNER_WELCOME` 사용

**Step 2: 커밋**

```bash
git add packages/features/agent-desk/service/session.service.ts
git commit -m "feat(agent-desk): support designer session type in SessionService"
```

---

## Task 9: 서버 빌드 검증

**Step 1: TypeScript 빌드 테스트**

Run: `cd apps/server && pnpm tsc --noEmit`
Expected: 에러 없이 통과

Run: `cd packages/drizzle && pnpm tsc --noEmit`
Expected: 에러 없이 통과

**Step 2: 에러 수정 (필요 시)**

타입 에러가 있으면 수정 후 다시 빌드.

**Step 3: 커밋 (수정사항이 있는 경우)**

```bash
git add -A
git commit -m "fix(agent-desk): resolve build errors in flow designer server code"
```

---

## Task 10: 클라이언트 — i18n 문자열 추가

**Files:**
- Modify: `apps/app/src/features/agent-desk/locales/ko.json`
- Modify: `apps/app/src/features/agent-desk/locales/en.json`

**Step 1: ko.json에 flow designer 문자열 추가**

기존 파일에 아래 키 추가:

```json
{
  "designerTitle": "화면 흐름 설계",
  "designerSubtitle": "AI와 대화하며 화면 흐름을 정의합니다",
  "flowPanel": "화면 흐름",
  "wireframePreview": "와이어프레임",
  "addScreen": "다음 화면 추가",
  "completeDesign": "완료",
  "prevScreen": "이전",
  "nextScreen": "다음",
  "platformMobile": "모바일",
  "platformDesktop": "데스크탑",
  "platformLabel": "플랫폼",
  "designThemeLabel": "디자인 테마",
  "designThemePlaceholder": "예: 미니멀, 다크 모드, 카드 UI",
  "screenName": "화면 이름",
  "screenEmpty": "아직 정의된 화면이 없습니다",
  "currentScreen": "현재 화면",
  "statusDesigning": "설계 중",
  "sessionDesigner": "화면 흐름 설계",
  "newDesignerSession": "새 화면 흐름 설계",
  "completingDesign": "화면정의서를 생성하고 있습니다...",
  "designCompleted": "화면정의서가 생성되었습니다"
}
```

**Step 2: en.json에 대응하는 영어 문자열 추가**

**Step 3: 커밋**

```bash
git add apps/app/src/features/agent-desk/locales/
git commit -m "feat(agent-desk): add flow designer i18n strings"
```

---

## Task 11: 클라이언트 — useFlowDesigner Hook 구현

**Files:**
- Create: `apps/app/src/features/agent-desk/hooks/use-flow-designer.ts`
- Modify: `apps/app/src/features/agent-desk/hooks/index.ts`

**Step 1: use-flow-designer.ts 작성**

```typescript
import { useTRPC } from "../../../lib/trpc";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

/** 화면 흐름 데이터 조회 */
export function useFlowData(sessionId: string) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.agentDesk.getFlowData.queryOptions({ sessionId }),
    enabled: !!sessionId,
  });
}

/** 화면 추가 */
export function useAddScreen() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation({
    ...trpc.agentDesk.addScreen.mutationOptions(),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: trpc.agentDesk.getFlowData.queryKey({ sessionId: variables.sessionId }),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.agentDesk.getSession.queryKey({ id: variables.sessionId }),
      });
    },
  });
}

/** 화면 업데이트 */
export function useUpdateScreen() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation({
    ...trpc.agentDesk.updateScreen.mutationOptions(),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: trpc.agentDesk.getFlowData.queryKey({ sessionId: variables.sessionId }),
      });
    },
  });
}

/** 화면 삭제 */
export function useRemoveScreen() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation({
    ...trpc.agentDesk.removeScreen.mutationOptions(),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: trpc.agentDesk.getFlowData.queryKey({ sessionId: variables.sessionId }),
      });
    },
  });
}

/** 디자이너 설정 업데이트 */
export function useUpdateDesignerSettings() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation({
    ...trpc.agentDesk.updateDesignerSettings.mutationOptions(),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: trpc.agentDesk.getSession.queryKey({ id: variables.sessionId }),
      });
    },
  });
}

/** 화면 흐름 설계 완료 */
export function useCompleteFlowDesign() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation({
    ...trpc.agentDesk.completeFlowDesign.mutationOptions(),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: trpc.agentDesk.getSession.queryKey({ id: variables.sessionId }),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.agentDesk.getFlowData.queryKey({ sessionId: variables.sessionId }),
      });
    },
  });
}
```

**Step 2: hooks/index.ts에 export 추가**

```typescript
export * from "./use-flow-designer";
```

**Step 3: 커밋**

```bash
git add apps/app/src/features/agent-desk/hooks/
git commit -m "feat(agent-desk): add flow designer client hooks"
```

---

## Task 12: 클라이언트 — FlowPanel 컴포넌트 (좌측 플로우차트)

**Files:**
- Create: `apps/app/src/features/agent-desk/components/flow-panel.tsx`

**Step 1: flow-panel.tsx 작성**

Mermaid flowchart를 렌더링하고, 각 노드 클릭 시 화면 전환하는 패널.

핵심 구조:
- props: `flowData`, `currentScreenIndex`, `onScreenSelect`, `onRemoveScreen`
- Mermaid 코드를 `flowData`에서 동적 생성
- 현재 화면 강조 (style 적용)
- 화면 목록을 리스트로도 표시 (Mermaid 렌더링 실패 대비)
- 빈 상태: "아직 정의된 화면이 없습니다" 메시지

**Step 2: 커밋**

```bash
git add apps/app/src/features/agent-desk/components/flow-panel.tsx
git commit -m "feat(agent-desk): add FlowPanel component"
```

---

## Task 13: 클라이언트 — WireframePreview 컴포넌트 (중앙)

**Files:**
- Create: `apps/app/src/features/agent-desk/components/wireframe-preview.tsx`

**Step 1: wireframe-preview.tsx 작성**

현재 선택된 화면의 와이어프레임을 표시.

핵심 구조:
- props: `screen` (현재 FlowScreen), `platform` ("mobile" | "desktop")
- platform에 따라 모바일(좁은 프레임)/데스크탑(넓은 프레임) 스타일 적용
- Mermaid 코드가 있으면 렌더링, 없으면 화면 이름 + "와이어프레임 대기 중" 메시지
- 화면 설명 텍스트 표시

**Step 2: 커밋**

```bash
git add apps/app/src/features/agent-desk/components/wireframe-preview.tsx
git commit -m "feat(agent-desk): add WireframePreview component"
```

---

## Task 14: 클라이언트 — DesignerHeader 컴포넌트

**Files:**
- Create: `apps/app/src/features/agent-desk/components/designer-header.tsx`

**Step 1: designer-header.tsx 작성**

헤더 영역 — 뒤로가기, 프로젝트명, 플랫폼 선택, 테마 입력.

핵심 구조:
- props: `session`, `onBack`, `onSettingsChange`
- Select 드롭다운: 모바일/데스크탑
- Input: 디자인 테마 (debounced 저장)
- 세션 제목 표시

**Step 2: 커밋**

```bash
git add apps/app/src/features/agent-desk/components/designer-header.tsx
git commit -m "feat(agent-desk): add DesignerHeader component"
```

---

## Task 15: 클라이언트 — FlowDesigner 메인 페이지 (3칸 레이아웃)

**Files:**
- Create: `apps/app/src/features/agent-desk/pages/flow-designer.tsx`

**Step 1: flow-designer.tsx 작성**

3칸 분할 메인 페이지. 기존 `chat.tsx`의 채팅 부분을 재활용.

핵심 구조:
```
<div className="flex h-screen flex-col">
  <DesignerHeader ... />
  <div className="flex flex-1 overflow-hidden">
    <FlowPanel ... />            {/* ≈20% */}
    <WireframePreview ... />     {/* ≈35% */}
    <ChatSection ... />          {/* ≈45% — 기존 채팅 UI 재활용 */}
  </div>
  <Footer ... />                 {/* 이전/다음/완료 버튼 */}
</div>
```

- `useSession(sessionId)`: 세션 데이터
- `useFlowData(sessionId)`: 화면 흐름 데이터
- `useStreamChat()`: AI 채팅
- `useAddScreen()`: 화면 추가
- `useCompleteFlowDesign()`: 완료 처리

ChatSection은 기존 `chat.tsx`에서 메시지 표시 + 입력 부분을 추출한 컴포넌트. 채팅 영역의 핵심 로직(메시지 표시, 입력, 스트리밍)은 기존 코드를 참고하여 동일 패턴으로 구현.

**Step 2: 커밋**

```bash
git add apps/app/src/features/agent-desk/pages/flow-designer.tsx
git commit -m "feat(agent-desk): add FlowDesigner main page with 3-panel layout"
```

---

## Task 16: 클라이언트 — 라우트 추가 + 세션 목록 수정

**Files:**
- Create: `apps/app/src/features/agent-desk/routes/agent-desk-designer-page.tsx`
- Modify: `apps/app/src/features/agent-desk/routes/index.ts`
- Modify: `apps/app/src/features/agent-desk/pages/session-list.tsx`
- Modify: `apps/app/src/features/agent-desk/components/status-badge.tsx`

**Step 1: 라우트 페이지 컴포넌트 생성**

`routes/agent-desk-designer-page.tsx`:
```typescript
import { useParams } from "@tanstack/react-router";
import { FlowDesigner } from "../pages/flow-designer";

export function AgentDeskDesignerPage() {
  const { sessionId } = useParams({ strict: false }) as { sessionId: string };
  return <FlowDesigner sessionId={sessionId} />;
}
```

**Step 2: routes/index.ts에 라우트 추가**

```typescript
import { AgentDeskDesignerPage } from "./agent-desk-designer-page";

export const AGENT_DESK_DESIGNER_PATH = "/agent-desk/designer/$sessionId";

export const createAgentDeskDesignerRoute = <T extends AnyRoute>(parentRoute: T) =>
  createRoute({
    getParentRoute: () => parentRoute,
    path: "/agent-desk/designer/$sessionId",
    component: AgentDeskDesignerPage,
  });

// createAgentDeskRoutes에 추가
export function createAgentDeskRoutes<T extends AnyRoute>(parentRoute: T) {
  return [
    createAgentDeskCustomerRoute(parentRoute),
    createAgentDeskOperatorRoute(parentRoute),
    createAgentDeskDesignerRoute(parentRoute),  // 새로 추가 (chat보다 먼저)
    createAgentDeskChatRoute(parentRoute),
    createAgentDeskTerminalRoute(parentRoute),
  ];
}
```

**주의**: `designer/$sessionId`가 `$sessionId`보다 먼저 매칭되어야 하므로 순서 중요.

**Step 3: session-list.tsx에 designer 세션 지원 추가**

- 세션 목록에 `"designer"` 타입 탭 추가
- 세션 생성 다이얼로그에 `"designer"` 옵션 추가
- designer 세션 클릭 시 `/agent-desk/designer/${id}`로 네비게이션

**Step 4: status-badge.tsx에 "designing" 상태 추가**

```typescript
designing: { key: "statusDesigning", variant: "secondary" },
```

**Step 5: 커밋**

```bash
git add apps/app/src/features/agent-desk/routes/ apps/app/src/features/agent-desk/pages/session-list.tsx apps/app/src/features/agent-desk/components/status-badge.tsx
git commit -m "feat(agent-desk): add designer route and update session list"
```

---

## Task 17: 클라이언트 빌드 검증

**Step 1: TypeScript 빌드 테스트**

Run: `cd apps/app && pnpm tsc --noEmit`
Expected: 에러 없이 통과

**Step 2: 에러 수정 (필요 시)**

타입 에러가 있으면 수정 후 다시 빌드.

**Step 3: 커밋 (수정사항이 있는 경우)**

```bash
git add -A
git commit -m "fix(agent-desk): resolve build errors in flow designer client code"
```

---

## Task 18: 런타임 검증 — 서버 API

**Precondition:** server가 실행 중이어야 함.

**Step 1: 서버 실행 확인**

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/api/health`
Expected: `200`

**Step 2: designer 세션 생성 테스트**

```bash
# tRPC를 통한 세션 생성 (인증 필요 — 토큰 필요)
curl -s http://localhost:3002/api/agent-desk -X POST \
  -H "Content-Type: application/json" \
  -d '{"type":"designer","title":"테스트 설계","platform":"mobile"}' | head -c 500
```

**Step 3: Swagger 확인**

브라우저에서 `http://localhost:3002/api-docs` 접속하여 flow designer 엔드포인트가 표시되는지 확인.

---

## Task 19: 런타임 검증 — 브라우저

**Precondition:** Vite dev 서버가 실행 중이어야 함.

**Step 1: Playwright MCP로 세션 목록 페이지 확인**

- `http://localhost:3000/agent-desk`로 이동
- designer 세션 생성 옵션이 보이는지 확인
- 콘솔 에러 없는지 확인

**Step 2: designer 세션 생성 후 3칸 레이아웃 확인**

- designer 세션 생성
- `/agent-desk/designer/$sessionId`로 이동
- 3칸 레이아웃(Flow Panel, Wireframe Preview, AI Chat) 렌더링 확인

---

## Task 20: 레퍼런스 문서 업데이트

**Files:**
- Modify: `docs/reference/features-backend.md`
- Modify: `docs/reference/features-frontend.md`
- Modify: `docs/reference/database-schema.md`

**Step 1: features-backend.md 업데이트**

Agent Desk 섹션에 FlowDesignerService 추가.

**Step 2: features-frontend.md 업데이트**

Agent Desk 섹션에 designer 라우트, 컴포넌트, hooks 추가.

**Step 3: database-schema.md 업데이트**

agent_desk_sessions 테이블에 새 컬럼(platform, designTheme, flowData) 추가.

**Step 4: 커밋**

```bash
git add docs/reference/
git commit -m "docs(agent-desk): update reference docs for flow designer"
```
