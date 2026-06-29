# FEA-147: Source 수집과 Requirement 정규화 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 다중 문서 source를 동일 contract로 저장하고, 정규화된 requirement와 source trace를 세션에 영속화한다.

**Architecture:** 기존 agent-desk feature에 2개의 새 DB 테이블(`agent_desk_requirement_sources`, `agent_desk_normalized_requirements`)과 2개의 새 Service(`RequirementSourceService`, `RequirementNormalizerService`)를 추가한다. 기존 tRPC Router와 REST Controller에 4개의 새 프로시저/엔드포인트를 추가하고, 모든 API에 세션 소유권 검증을 적용한다.

**Tech Stack:** Drizzle ORM (PostgreSQL), NestJS, tRPC v11, Zod, Jest

**Design Doc:** `docs/plans/2026-03-07-fea-147-source-requirement-design.md`

---

## Task 1: Schema — Enum과 테이블 정의

**Files:**
- Modify: `packages/drizzle/src/schema/features/agent-desk/index.ts`

**Step 1: 새 enum과 테이블 추가**

```typescript
// === 아래를 기존 enum 선언 뒤에 추가 ===

export const agentDeskSourceTypeEnum = pgEnum("agent_desk_source_type", [
  "pdf", "docx", "md", "txt", "manual",
]);

export const agentDeskParseStatusEnum = pgEnum("agent_desk_parse_status", [
  "pending", "parsed", "failed",
]);

export const agentDeskRequirementCategoryEnum = pgEnum("agent_desk_requirement_category", [
  "feature", "role", "entity", "validation", "exception",
]);

export const agentDeskConflictStatusEnum = pgEnum("agent_desk_conflict_status", [
  "none", "duplicate", "conflict",
]);

// === 아래를 기존 Tables 섹션 끝에 추가 ===

export const agentDeskRequirementSources = pgTable("agent_desk_requirement_sources", {
  ...baseColumns(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => agentDeskSessions.id, { onDelete: "cascade" }),
  sourceType: agentDeskSourceTypeEnum("source_type").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  rawContent: text("raw_content"),
  parsedContent: text("parsed_content"),
  priority: integer("priority").notNull().default(3),
  trustScore: integer("trust_score").notNull().default(100), // 0-100 (numeric * 100)
  parseStatus: agentDeskParseStatusEnum("parse_status").notNull().default("pending"),
  fileId: uuid("file_id").references(() => agentDeskFiles.id, { onDelete: "set null" }),
  metadata: jsonb("metadata"),
});

export const agentDeskNormalizedRequirements = pgTable("agent_desk_normalized_requirements", {
  ...baseColumns(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => agentDeskSessions.id, { onDelete: "cascade" }),
  category: agentDeskRequirementCategoryEnum("category").notNull(),
  summary: varchar("summary", { length: 500 }).notNull(),
  detail: text("detail"),
  sourceIds: text("source_ids").array(),
  confidence: integer("confidence").notNull().default(80), // 0-100
  conflictStatus: agentDeskConflictStatusEnum("conflict_status").notNull().default("none"),
  dedupeGroupId: uuid("dedupe_group_id"),
});
```

**Step 2: Relations 추가**

```typescript
// === 기존 agentDeskSessionsRelations에 추가 ===
// many 필드에 requirementSources와 normalizedRequirements 추가

export const agentDeskRequirementSourcesRelations = relations(agentDeskRequirementSources, ({ one }) => ({
  session: one(agentDeskSessions, {
    fields: [agentDeskRequirementSources.sessionId],
    references: [agentDeskSessions.id],
  }),
  file: one(agentDeskFiles, {
    fields: [agentDeskRequirementSources.fileId],
    references: [agentDeskFiles.id],
  }),
}));

export const agentDeskNormalizedRequirementsRelations = relations(agentDeskNormalizedRequirements, ({ one }) => ({
  session: one(agentDeskSessions, {
    fields: [agentDeskNormalizedRequirements.sessionId],
    references: [agentDeskSessions.id],
  }),
}));
```

**Step 3: Type Exports 추가**

```typescript
export type AgentDeskRequirementSource = typeof agentDeskRequirementSources.$inferSelect;
export type NewAgentDeskRequirementSource = typeof agentDeskRequirementSources.$inferInsert;
export type AgentDeskNormalizedRequirement = typeof agentDeskNormalizedRequirements.$inferSelect;
export type NewAgentDeskNormalizedRequirement = typeof agentDeskNormalizedRequirements.$inferInsert;
```

**Step 4: Commit**

```bash
git add packages/drizzle/src/schema/features/agent-desk/index.ts
git commit -m "feat(agent-desk): add requirement_sources and normalized_requirements schema

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Schema 등록 및 Migration

**Files:**
- Modify: `packages/drizzle/drizzle.config.ts`

**Step 1: tablesFilter에 새 테이블 추가**

`drizzle.config.ts`의 `tablesFilter` 배열에서 `// features/agent-desk` 섹션에 2줄 추가:

```typescript
    // features/agent-desk
    "agent_desk_sessions",
    "agent_desk_files",
    "agent_desk_messages",
    "agent_desk_executions",
    "agent_desk_requirement_sources",      // 추가
    "agent_desk_normalized_requirements",  // 추가
```

**Step 2: TypeScript 빌드 확인**

Run: `cd packages/drizzle && pnpm tsc --noEmit`
Expected: 에러 없음

**Step 3: Migration 생성**

Run: `cd packages/drizzle && pnpm drizzle-kit generate`
Expected: 새 migration 파일 생성 (agent_desk_requirement_sources, agent_desk_normalized_requirements 테이블 + 4개 enum)

**Step 4: Commit**

```bash
git add packages/drizzle/drizzle.config.ts packages/drizzle/migrations/
git commit -m "feat(agent-desk): register new tables and generate migration

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: DTO 정의

**Files:**
- Create: `packages/features/agent-desk/dto/requirement-source.dto.ts`
- Create: `packages/features/agent-desk/dto/normalize-requirements.dto.ts`
- Modify: `packages/features/agent-desk/dto/index.ts`

**Step 1: Source DTO 작성**

```typescript
// packages/features/agent-desk/dto/requirement-source.dto.ts
import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";

export const addRequirementSourceSchema = z.object({
  sessionId: z.string().uuid().describe("세션 ID"),
  sourceType: z.enum(["pdf", "docx", "md", "txt", "manual"]).describe("소스 유형"),
  title: z.string().min(1).max(500).describe("소스 제목"),
  rawContent: z.string().optional().describe("원본 텍스트 (manual 입력 시)"),
  fileId: z.string().uuid().optional().describe("업로드된 파일 ID"),
});

export class AddRequirementSourceDto extends createZodDto(addRequirementSourceSchema) {}

export const listRequirementSourcesSchema = z.object({
  sessionId: z.string().uuid().describe("세션 ID"),
});

export class ListRequirementSourcesDto extends createZodDto(listRequirementSourcesSchema) {}
```

**Step 2: Normalize DTO 작성**

```typescript
// packages/features/agent-desk/dto/normalize-requirements.dto.ts
import { createZodDto } from "@repo/shared/zod-nestjs";
import { z } from "zod";

export const normalizeRequirementsSchema = z.object({
  sessionId: z.string().uuid().describe("세션 ID"),
  model: z.string().optional().describe("사용할 LLM 모델 (선택)"),
});

export class NormalizeRequirementsDto extends createZodDto(normalizeRequirementsSchema) {}

export const listNormalizedRequirementsSchema = z.object({
  sessionId: z.string().uuid().describe("세션 ID"),
});

export class ListNormalizedRequirementsDto extends createZodDto(listNormalizedRequirementsSchema) {}
```

**Step 3: index.ts에 re-export 추가**

```typescript
// dto/index.ts에 추가
export * from "./requirement-source.dto";
export * from "./normalize-requirements.dto";
```

**Step 4: Commit**

```bash
git add packages/features/agent-desk/dto/
git commit -m "feat(agent-desk): add DTOs for requirement sources and normalization

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 4: RequirementSourceService 구현

**Files:**
- Create: `packages/features/agent-desk/service/requirement-source.service.ts`
- Modify: `packages/features/agent-desk/service/index.ts`

**Step 1: Service 작성**

```typescript
// packages/features/agent-desk/service/requirement-source.service.ts
import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { eq, desc } from "drizzle-orm";
import { InjectDrizzle, type DrizzleDB } from "@repo/drizzle";
import { agentDeskRequirementSources, agentDeskFiles } from "@repo/drizzle";
import { createLogger } from "@repo/core/logger";
import { SessionService } from "./session.service";
import { FileParserService } from "./file-parser.service";
import type { AddRequirementSourceDto } from "../dto/requirement-source.dto";

const logger = createLogger("agent-desk");

@Injectable()
export class RequirementSourceService {
  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly sessionService: SessionService,
    private readonly fileParserService: FileParserService,
  ) {}

  async addSource(input: AddRequirementSourceDto, userId: string) {
    // 소유권 검증
    await this.sessionService.verifySessionOwnership(input.sessionId, userId);

    // manual 타입은 rawContent 필수
    if (input.sourceType === "manual" && !input.rawContent) {
      throw new BadRequestException("rawContent is required for manual source type");
    }

    // 파일 타입은 fileId 필수
    if (input.sourceType !== "manual" && !input.fileId) {
      throw new BadRequestException("fileId is required for file-based source type");
    }

    const [source] = await this.db
      .insert(agentDeskRequirementSources)
      .values({
        sessionId: input.sessionId,
        sourceType: input.sourceType,
        title: input.title,
        rawContent: input.rawContent ?? null,
        fileId: input.fileId ?? null,
        parseStatus: input.sourceType === "manual" ? "parsed" : "pending",
        parsedContent: input.sourceType === "manual" ? input.rawContent : null,
      })
      .returning();

    logger.info("Requirement source added", {
      "agent_desk.source_id": source.id,
      "agent_desk.session_id": input.sessionId,
      "agent_desk.source_type": input.sourceType,
      "user.id": userId,
    });

    // 파일 기반 소스는 비동기 파싱 트리거
    if (input.sourceType !== "manual" && input.fileId) {
      this.triggerParsing(source.id, input.fileId).catch((err) => {
        logger.error("Source parsing failed", {
          "agent_desk.source_id": source.id,
          "error.message": err.message,
        });
      });
    }

    return source;
  }

  async listSources(sessionId: string, userId: string) {
    await this.sessionService.verifySessionOwnership(sessionId, userId);

    return this.db.query.agentDeskRequirementSources.findMany({
      where: eq(agentDeskRequirementSources.sessionId, sessionId),
      orderBy: [desc(agentDeskRequirementSources.createdAt)],
    });
  }

  private async triggerParsing(sourceId: string, fileId: string) {
    try {
      const result = await this.fileParserService.parseFile(fileId);

      await this.db
        .update(agentDeskRequirementSources)
        .set({
          parsedContent: result.content,
          parseStatus: "parsed",
          metadata: result.metadata,
        })
        .where(eq(agentDeskRequirementSources.id, sourceId));

      logger.info("Requirement source parsed", {
        "agent_desk.source_id": sourceId,
      });
    } catch (error) {
      await this.db
        .update(agentDeskRequirementSources)
        .set({ parseStatus: "failed" })
        .where(eq(agentDeskRequirementSources.id, sourceId));
      throw error;
    }
  }
}
```

**Step 2: index.ts에 export 추가**

```typescript
// service/index.ts에 추가
export { RequirementSourceService } from "./requirement-source.service";
```

**Step 3: Commit**

```bash
git add packages/features/agent-desk/service/requirement-source.service.ts packages/features/agent-desk/service/index.ts
git commit -m "feat(agent-desk): implement RequirementSourceService

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 5: RequirementNormalizerService 구현

**Files:**
- Create: `packages/features/agent-desk/service/requirement-normalizer.service.ts`
- Modify: `packages/features/agent-desk/service/index.ts`

**Step 1: Service 작성**

```typescript
// packages/features/agent-desk/service/requirement-normalizer.service.ts
import { Injectable } from "@nestjs/common";
import { eq, desc } from "drizzle-orm";
import { InjectDrizzle, type DrizzleDB } from "@repo/drizzle";
import {
  agentDeskRequirementSources,
  agentDeskNormalizedRequirements,
} from "@repo/drizzle";
import { createLogger } from "@repo/core/logger";
import { LLMService } from "@repo/features/ai";
import { SessionService } from "./session.service";
import type { NormalizeRequirementsDto } from "../dto/normalize-requirements.dto";

const logger = createLogger("agent-desk");

const NORMALIZE_SYSTEM_PROMPT = `당신은 요구사항 분석 전문가입니다. 여러 소스에서 수집된 원문을 분석하여 정규화된 요구사항 목록을 생성합니다.

각 요구사항은 다음 형식으로 반환해주세요:
- category: "feature" | "role" | "entity" | "validation" | "exception"
- summary: 한 줄 요약 (최대 500자)
- detail: 상세 설명
- sourceIds: 이 요구사항의 근거가 된 source ID 배열
- confidence: 확신도 (0-100)
- conflictStatus: "none" | "duplicate" | "conflict"
- dedupeGroupId: 중복/충돌 그룹 ID (같은 그룹이면 동일 UUID)

중복되는 요구사항은 conflictStatus를 "duplicate"로, 서로 충돌하는 요구사항은 "conflict"로 표시합니다.

결과는 JSON 배열로 반환해주세요.`;

interface NormalizedRequirementItem {
  category: "feature" | "role" | "entity" | "validation" | "exception";
  summary: string;
  detail: string;
  sourceIds: string[];
  confidence: number;
  conflictStatus: "none" | "duplicate" | "conflict";
  dedupeGroupId?: string;
}

@Injectable()
export class RequirementNormalizerService {
  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly sessionService: SessionService,
    private readonly llmService: LLMService,
  ) {}

  async normalize(input: NormalizeRequirementsDto, userId: string) {
    await this.sessionService.verifySessionOwnership(input.sessionId, userId);

    // 파싱 완료된 source 목록 조회
    const sources = await this.db.query.agentDeskRequirementSources.findMany({
      where: eq(agentDeskRequirementSources.sessionId, input.sessionId),
    });

    const parsedSources = sources.filter((s) => s.parseStatus === "parsed");
    if (parsedSources.length === 0) {
      return { requirements: [], conflicts: [] };
    }

    // LLM 호출로 정규화
    const sourceContext = parsedSources
      .map((s) => `[Source ID: ${s.id}, Title: ${s.title}]\n${s.parsedContent ?? s.rawContent ?? ""}`)
      .join("\n\n---\n\n");

    const result = await this.llmService.generateText({
      system: NORMALIZE_SYSTEM_PROMPT,
      prompt: `다음 소스들에서 요구사항을 추출하고 정규화해주세요:\n\n${sourceContext}`,
      ...(input.model && { model: input.model }),
    });

    const items: NormalizedRequirementItem[] = JSON.parse(
      result.text.replace(/```json\n?/g, "").replace(/```\n?/g, ""),
    );

    // 기존 정규화 결과 삭제 후 새로 삽입
    await this.db
      .delete(agentDeskNormalizedRequirements)
      .where(eq(agentDeskNormalizedRequirements.sessionId, input.sessionId));

    const requirements = [];
    for (const item of items) {
      const [req] = await this.db
        .insert(agentDeskNormalizedRequirements)
        .values({
          sessionId: input.sessionId,
          category: item.category,
          summary: item.summary,
          detail: item.detail,
          sourceIds: item.sourceIds,
          confidence: item.confidence,
          conflictStatus: item.conflictStatus,
          dedupeGroupId: item.dedupeGroupId ?? null,
        })
        .returning();
      requirements.push(req);
    }

    const conflicts = requirements.filter((r) => r.conflictStatus !== "none");

    logger.info("Requirements normalized", {
      "agent_desk.session_id": input.sessionId,
      "agent_desk.requirement_count": requirements.length,
      "agent_desk.conflict_count": conflicts.length,
      "user.id": userId,
    });

    return { requirements, conflicts };
  }

  async listRequirements(sessionId: string, userId: string) {
    await this.sessionService.verifySessionOwnership(sessionId, userId);

    return this.db.query.agentDeskNormalizedRequirements.findMany({
      where: eq(agentDeskNormalizedRequirements.sessionId, sessionId),
      orderBy: [desc(agentDeskNormalizedRequirements.createdAt)],
    });
  }
}
```

**Step 2: index.ts에 export 추가**

```typescript
// service/index.ts에 추가
export { RequirementNormalizerService } from "./requirement-normalizer.service";
```

**Step 3: Commit**

```bash
git add packages/features/agent-desk/service/requirement-normalizer.service.ts packages/features/agent-desk/service/index.ts
git commit -m "feat(agent-desk): implement RequirementNormalizerService with LLM normalization

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 6: tRPC Router에 프로시저 추가

**Files:**
- Modify: `packages/features/agent-desk/trpc/agent-desk.route.ts`

**Step 1: import 추가**

```typescript
// 기존 import에 추가
import { addRequirementSourceSchema, listRequirementSourcesSchema } from "../dto/requirement-source.dto";
import { normalizeRequirementsSchema, listNormalizedRequirementsSchema } from "../dto/normalize-requirements.dto";
import type { RequirementSourceService } from "../service/requirement-source.service";
import type { RequirementNormalizerService } from "../service/requirement-normalizer.service";
```

**Step 2: services container 타입에 추가**

```typescript
const services = createServiceContainer<{
  // ... 기존 서비스들 ...
  requirementSourceService: RequirementSourceService;
  requirementNormalizerService: RequirementNormalizerService;
}>();
```

**Step 3: Router에 4개 프로시저 추가**

```typescript
  // ========================================
  // Requirement Sources
  // ========================================

  /** Source 추가 */
  addRequirementSource: authProcedure
    .input(addRequirementSourceSchema)
    .mutation(async ({ input, ctx }) => {
      const userId = getAuthUserId(ctx);
      return services.get().requirementSourceService.addSource(input, userId);
    }),

  /** Source 목록 조회 */
  listRequirementSources: authProcedure
    .input(listRequirementSourcesSchema)
    .query(async ({ input, ctx }) => {
      const userId = getAuthUserId(ctx);
      return services.get().requirementSourceService.listSources(input.sessionId, userId);
    }),

  // ========================================
  // Normalized Requirements
  // ========================================

  /** 요구사항 정규화 실행 */
  normalizeRequirements: authProcedure
    .input(normalizeRequirementsSchema)
    .mutation(async ({ input, ctx }) => {
      const userId = getAuthUserId(ctx);
      return services.get().requirementNormalizerService.normalize(input, userId);
    }),

  /** 정규화된 요구사항 목록 조회 */
  listNormalizedRequirements: authProcedure
    .input(listNormalizedRequirementsSchema)
    .query(async ({ input, ctx }) => {
      const userId = getAuthUserId(ctx);
      return services.get().requirementNormalizerService.listRequirements(input.sessionId, userId);
    }),
```

**Step 4: Commit**

```bash
git add packages/features/agent-desk/trpc/agent-desk.route.ts
git commit -m "feat(agent-desk): add tRPC procedures for sources and requirements

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 7: REST Controller에 엔드포인트 추가

**Files:**
- Modify: `packages/features/agent-desk/controller/agent-desk.controller.ts`

**Step 1: import 추가**

```typescript
import { RequirementSourceService } from "../service/requirement-source.service";
import { RequirementNormalizerService } from "../service/requirement-normalizer.service";
import type { AddRequirementSourceDto } from "../dto/requirement-source.dto";
import type { NormalizeRequirementsDto } from "../dto/normalize-requirements.dto";
```

**Step 2: constructor에 서비스 추가**

```typescript
constructor(
  // ... 기존 서비스들 ...
  private readonly requirementSourceService: RequirementSourceService,
  private readonly requirementNormalizerService: RequirementNormalizerService,
) {}
```

**Step 3: 4개 엔드포인트 추가**

```typescript
  // ============================================================================
  // Requirement Source Endpoints
  // ============================================================================

  /** POST /api/agent-desk/sources - Source 추가 */
  @Post("sources")
  @ApiOperation({ summary: "요구사항 소스 추가" })
  @ApiResponse({ status: 201, description: "소스 추가 성공" })
  @ApiResponse({ status: 400, description: "잘못된 요청" })
  @ApiResponse({ status: 403, description: "세션 접근 권한 없음" })
  async addRequirementSource(@CurrentUser() user: User, @Body() dto: AddRequirementSourceDto) {
    return this.requirementSourceService.addSource(dto, user.id);
  }

  /** GET /api/agent-desk/sources?sessionId= - Source 목록 조회 */
  @Get("sources")
  @ApiOperation({ summary: "요구사항 소스 목록 조회" })
  @ApiQuery({ name: "sessionId", required: true, type: String })
  @ApiResponse({ status: 200, description: "소스 목록 반환" })
  async listRequirementSources(
    @CurrentUser() user: User,
    @Query("sessionId", ParseUUIDPipe) sessionId: string,
  ) {
    return this.requirementSourceService.listSources(sessionId, user.id);
  }

  // ============================================================================
  // Normalized Requirement Endpoints
  // ============================================================================

  /** POST /api/agent-desk/requirements/normalize - 요구사항 정규화 */
  @Post("requirements/normalize")
  @ApiOperation({ summary: "요구사항 정규화 실행" })
  @ApiResponse({ status: 200, description: "정규화 성공" })
  async normalizeRequirements(@CurrentUser() user: User, @Body() dto: NormalizeRequirementsDto) {
    return this.requirementNormalizerService.normalize(dto, user.id);
  }

  /** GET /api/agent-desk/requirements?sessionId= - 정규화된 요구사항 목록 */
  @Get("requirements")
  @ApiOperation({ summary: "정규화된 요구사항 목록 조회" })
  @ApiQuery({ name: "sessionId", required: true, type: String })
  @ApiResponse({ status: 200, description: "요구사항 목록 반환" })
  async listNormalizedRequirements(
    @CurrentUser() user: User,
    @Query("sessionId", ParseUUIDPipe) sessionId: string,
  ) {
    return this.requirementNormalizerService.listRequirements(sessionId, user.id);
  }
```

**Step 4: Commit**

```bash
git add packages/features/agent-desk/controller/agent-desk.controller.ts
git commit -m "feat(agent-desk): add REST endpoints for sources and requirements

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 8: Module에 새 서비스 등록

**Files:**
- Modify: `packages/features/agent-desk/agent-desk.module.ts`
- Modify: `packages/features/agent-desk/index.ts`

**Step 1: Module에 서비스 추가**

```typescript
import {
  // ... 기존 import ...
  RequirementSourceService,
  RequirementNormalizerService,
} from "./service";

@Module({
  imports: [AIModule],
  controllers: [AgentDeskController],
  providers: [
    // ... 기존 providers ...
    RequirementSourceService,
    RequirementNormalizerService,
  ],
  exports: [
    // ... 기존 exports ...
    RequirementSourceService,
    RequirementNormalizerService,
  ],
})
export class AgentDeskModule implements OnModuleInit {
  constructor(
    // ... 기존 constructor 파라미터 ...
    private readonly requirementSourceService: RequirementSourceService,
    private readonly requirementNormalizerService: RequirementNormalizerService,
  ) {}

  onModuleInit() {
    injectAgentDeskServices({
      // ... 기존 서비스들 ...
      requirementSourceService: this.requirementSourceService,
      requirementNormalizerService: this.requirementNormalizerService,
    });
  }
}
```

**Step 2: index.ts에 export 추가**

```typescript
// Services에 추가
export {
  // ... 기존 exports ...
  RequirementSourceService,
  RequirementNormalizerService,
} from "./service";
```

**Step 3: Commit**

```bash
git add packages/features/agent-desk/agent-desk.module.ts packages/features/agent-desk/index.ts
git commit -m "feat(agent-desk): register new services in module and exports

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 9: TypeScript 빌드 검증

**Files:** (수정 없음 — 검증만)

**Step 1: 전체 빌드 확인**

Run: `cd packages/drizzle && pnpm tsc --noEmit`
Expected: PASS

Run: `cd apps/server && pnpm tsc --noEmit`
Expected: PASS

**Step 2: 빌드 에러 수정 (있으면)**

빌드 에러가 발생하면 원인을 파악하고 해당 파일을 수정합니다. 일반적인 에러:
- import 경로 오류 → 경로 수정
- 타입 불일치 → DTO/Schema 타입 조정
- service container 타입 누락 → trpc route의 createServiceContainer 타입 업데이트

---

## Task 10: Unit Test 작성

**Files:**
- Create: `packages/features/agent-desk/service/requirement-source.service.spec.ts`
- Create: `packages/features/agent-desk/service/requirement-normalizer.service.spec.ts`

**Step 1: RequirementSourceService 테스트**

테스트 케이스:
1. `addSource` — manual 소스 추가 성공
2. `addSource` — manual 타입에 rawContent 누락 시 BadRequestException
3. `addSource` — file 타입에 fileId 누락 시 BadRequestException
4. `addSource` — 세션 소유권 없으면 ForbiddenException
5. `listSources` — 세션별 소스 목록 반환

기존 spec 파일 패턴(`session.service.spec.ts`)을 참고하여 mock 설정.

**Step 2: RequirementNormalizerService 테스트**

테스트 케이스:
1. `normalize` — 파싱된 소스로 정규화 성공
2. `normalize` — 파싱된 소스 없으면 빈 배열 반환
3. `normalize` — 세션 소유권 없으면 ForbiddenException
4. `listRequirements` — 세션별 요구사항 목록 반환

**Step 3: 테스트 실행**

Run: `pnpm -F @repo/features test -- --testPathPattern="requirement"`
Expected: 전체 PASS

**Step 4: Commit**

```bash
git add packages/features/agent-desk/service/requirement-source.service.spec.ts packages/features/agent-desk/service/requirement-normalizer.service.spec.ts
git commit -m "test(agent-desk): add unit tests for requirement source and normalizer services

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 11: Migration 적용 및 런타임 검증

**Step 1: DB Migration 적용**

Run: `cd packages/drizzle && pnpm drizzle-kit push`
Expected: 테이블 생성 성공

**Step 2: 서버 시작 후 API 검증**

서버가 실행 중인지 확인. 실행 중이 아니면 사용자에게 요청.

```bash
# Source 목록 조회 (빈 결과 예상)
curl -s -w "\n%{http_code}" -H "Authorization: Bearer {token}" \
  "http://localhost:3002/api/agent-desk/sources?sessionId={session-id}"

# tRPC 경로 확인
curl -s -w "\n%{http_code}" \
  "http://localhost:3002/trpc/agentDesk.listRequirementSources?input=%7B%22sessionId%22%3A%22test%22%7D"
```

Expected: 200 (빈 배열) 또는 401 (인증 필요 — 정상)

**Step 3: Swagger 확인**

브라우저에서 `http://localhost:3002/api-docs`에 접속하여 새 엔드포인트 4개가 표시되는지 확인.

---

## Task 12: 레퍼런스 문서 업데이트

**Files:**
- Modify: `docs/reference/features-backend.md`
- Modify: `docs/reference/database-schema.md`

**Step 1: features-backend.md에 새 서비스/프로시저 추가**

Agent Desk 섹션에:
- `RequirementSourceService` — addSource, listSources, triggerParsing
- `RequirementNormalizerService` — normalize, listRequirements
- tRPC: addRequirementSource, listRequirementSources, normalizeRequirements, listNormalizedRequirements
- REST: POST /sources, GET /sources, POST /requirements/normalize, GET /requirements

**Step 2: database-schema.md에 새 테이블 추가**

Agent Desk 섹션에:
- `agent_desk_requirement_sources` — sourceType, title, rawContent, parsedContent, priority, trustScore, parseStatus, fileId, metadata
- `agent_desk_normalized_requirements` — category, summary, detail, sourceIds, confidence, conflictStatus, dedupeGroupId

**Step 3: Commit**

```bash
git add docs/reference/
git commit -m "docs(agent-desk): update reference docs for FEA-147

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Summary

| Task | 내용 | 파일 수 |
|------|------|--------|
| 1 | Schema (enum + 테이블 + relations + types) | 1 수정 |
| 2 | tablesFilter 등록 + migration 생성 | 1 수정 + migration |
| 3 | DTO 정의 (Zod schemas) | 2 생성, 1 수정 |
| 4 | RequirementSourceService | 1 생성, 1 수정 |
| 5 | RequirementNormalizerService | 1 생성, 1 수정 |
| 6 | tRPC Router (4 procedures) | 1 수정 |
| 7 | REST Controller (4 endpoints) | 1 수정 |
| 8 | Module + index.ts 등록 | 2 수정 |
| 9 | TypeScript 빌드 검증 | 검증만 |
| 10 | Unit Tests | 2 생성 |
| 11 | Migration 적용 + 런타임 검증 | 검증만 |
| 12 | 레퍼런스 문서 업데이트 | 2 수정 |
