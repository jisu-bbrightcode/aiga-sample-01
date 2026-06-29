# Agent Front Desk 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Product Builder 기존 features를 분석/조합하여 새 서비스를 생성하는 에이전트 기반 메타 도구

**Architecture:** 단일 `agent-desk` feature에 고객/운영자 모드. 에이전트 대화 기반 UI + 파일 업로드 → AI 분석 → 스펙 생성/프로젝트 scaffold (고객) 또는 Claude Code CLI 실행 (운영자)

**Tech Stack:** NestJS + Drizzle + tRPC + REST/Swagger + LLMService (OpenAI/Gemini/Claude fallback) + React + TanStack Router/Query + Jotai + SSE streaming

**설계 문서:** `docs/plans/2026-02-26-agent-front-desk-design.md`

---

## Phase 1: 인프라 + 에이전트 대화 (MVP)

### Task 1: DB 스키마 정의

**Files:**
- Create: `packages/drizzle/src/schema/features/agent-desk/index.ts`
- Modify: `packages/drizzle/src/schema/index.ts`

**Step 1: Feature 스키마 파일 생성**

```typescript
// packages/drizzle/src/schema/features/agent-desk/index.ts
import { baseColumns } from "../../../utils";
import { profiles } from "../../core/profiles";
import { integer, jsonb, pgEnum, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

// ============================================================================
// Enums
// ============================================================================

export const agentDeskSessionTypeEnum = pgEnum("agent_desk_session_type", [
  "customer",
  "operator",
]);

export const agentDeskSessionStatusEnum = pgEnum("agent_desk_session_status", [
  "uploading",
  "parsing",
  "analyzing",
  "analyzed",
  "reviewed",
  "spec_generated",
  "project_created",
  "executing",
  "executed",
  "failed",
]);

export const agentDeskMessageRoleEnum = pgEnum("agent_desk_message_role", [
  "agent",
  "user",
]);

// ============================================================================
// Tables
// ============================================================================

export const agentDeskSessions = pgTable("agent_desk_sessions", {
  ...baseColumns(),
  type: agentDeskSessionTypeEnum("type").notNull(),
  status: agentDeskSessionStatusEnum("status").notNull().default("uploading"),
  title: varchar("title", { length: 200 }),
  prompt: text("prompt"),
  createdById: uuid("created_by_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
});

export const agentDeskFiles = pgTable("agent_desk_files", {
  ...baseColumns(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => agentDeskSessions.id, { onDelete: "cascade" }),
  fileName: varchar("file_name", { length: 500 }).notNull(),
  originalName: varchar("original_name", { length: 500 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  size: integer("size").notNull(),
  storageUrl: text("storage_url").notNull(),
  parsedContent: text("parsed_content"),
  parsedAt: timestamp("parsed_at", { withTimezone: true }),
});

export const agentDeskMessages = pgTable("agent_desk_messages", {
  ...baseColumns(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => agentDeskSessions.id, { onDelete: "cascade" }),
  role: agentDeskMessageRoleEnum("role").notNull(),
  content: text("content").notNull(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type AgentDeskSession = typeof agentDeskSessions.$inferSelect;
export type NewAgentDeskSession = typeof agentDeskSessions.$inferInsert;

export type AgentDeskFile = typeof agentDeskFiles.$inferSelect;
export type NewAgentDeskFile = typeof agentDeskFiles.$inferInsert;

export type AgentDeskMessage = typeof agentDeskMessages.$inferSelect;
export type NewAgentDeskMessage = typeof agentDeskMessages.$inferInsert;
```

**Step 2: Schema index에 re-export 추가**

`packages/drizzle/src/schema/index.ts` 맨 끝에 추가:
```typescript
export * from "./features/agent-desk";
```

**Step 3: Migration 생성**

Run: `cd packages/drizzle && pnpm drizzle-kit generate`

**Step 4: Commit**

```bash
git add packages/drizzle/src/schema/features/agent-desk/index.ts packages/drizzle/src/schema/index.ts
git commit -m "feat(agent-desk): DB 스키마 정의 — sessions, files, messages 테이블"
```

---

### Task 2: Server Feature 폴더 구조 + Types + DTOs

**Files:**
- Create: `packages/features/agent-desk/index.ts`
- Create: `packages/features/agent-desk/types/index.ts`
- Create: `packages/features/agent-desk/dto/index.ts`
- Create: `packages/features/agent-desk/dto/create-session.dto.ts`
- Create: `packages/features/agent-desk/dto/send-message.dto.ts`
- Create: `packages/features/agent-desk/dto/upload-file.dto.ts`

**Step 1: Types 정의**

```typescript
// packages/features/agent-desk/types/index.ts

export type SessionType = "customer" | "operator";
export type SessionStatus =
  | "uploading" | "parsing" | "analyzing" | "analyzed"
  | "reviewed" | "spec_generated" | "project_created"
  | "executing" | "executed" | "failed";
export type MessageRole = "agent" | "user";

export interface ParsedFileResult {
  fileId: string;
  fileName: string;
  mimeType: string;
  content: string;
  metadata: {
    pageCount?: number;
    slideCount?: number;
    imageDescription?: string;
  };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}
```

**Step 2: DTOs 정의**

```typescript
// packages/features/agent-desk/dto/create-session.dto.ts
import { z } from "zod";

export const createSessionSchema = z.object({
  type: z.enum(["customer", "operator"]).describe("세션 유형"),
  title: z.string().max(200).optional().describe("세션 제목"),
  prompt: z.string().optional().describe("초기 프롬프트"),
});

export type CreateSessionDto = z.infer<typeof createSessionSchema>;
```

```typescript
// packages/features/agent-desk/dto/send-message.dto.ts
import { z } from "zod";

export const sendMessageSchema = z.object({
  sessionId: z.string().uuid().describe("세션 ID"),
  content: z.string().min(1).describe("메시지 내용"),
});

export type SendMessageDto = z.infer<typeof sendMessageSchema>;
```

```typescript
// packages/features/agent-desk/dto/upload-file.dto.ts
import { z } from "zod";

export const confirmUploadSchema = z.object({
  sessionId: z.string().uuid().describe("세션 ID"),
  fileName: z.string().describe("저장된 파일명"),
  originalName: z.string().describe("원본 파일명"),
  mimeType: z.string().describe("MIME 타입"),
  size: z.number().int().positive().describe("파일 크기 (bytes)"),
  storageUrl: z.string().url().describe("Storage URL"),
});

export type ConfirmUploadDto = z.infer<typeof confirmUploadSchema>;
```

```typescript
// packages/features/agent-desk/dto/index.ts
export * from "./create-session.dto";
export * from "./send-message.dto";
export * from "./upload-file.dto";
```

**Step 3: Feature index.ts**

```typescript
// packages/features/agent-desk/index.ts
export { AgentDeskModule } from "./agent-desk.module";
export { agentDeskRouter, type AgentDeskRouter } from "./trpc";
export * from "./types";
export * from "./dto";
```

**Step 4: Commit**

```bash
git add packages/features/agent-desk/
git commit -m "feat(agent-desk): types, DTOs, feature index 생성"
```

---

### Task 3: FileParserService 구현

**Files:**
- Create: `packages/features/agent-desk/service/file-parser.service.ts`

**Step 1: 의존성 설치**

Run: `cd packages/features && pnpm add pdf-parse sharp`

Note: `pptx2json`이 호환성 문제 시 `mammoth`(DOCX) + 자체 PPTX ZIP 파서 대안 사용. 이미지는 LLMService 멀티모달로 처리.

**Step 2: FileParserService 구현**

```typescript
// packages/features/agent-desk/service/file-parser.service.ts
import { Injectable, Logger } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { InjectDrizzle, type DrizzleDB } from "@repo/drizzle";
import { agentDeskFiles } from "@repo/drizzle";
import { createLogger } from "@repo/core/logger";
import type { LLMService } from "../../ai/service/llm.service";
import type { ParsedFileResult } from "../types";

const logger = createLogger("agent-desk");

@Injectable()
export class FileParserService {
  private llmService!: LLMService;

  constructor(@InjectDrizzle() private readonly db: DrizzleDB) {}

  setLLMService(service: LLMService) {
    this.llmService = service;
  }

  async parseFile(fileId: string): Promise<ParsedFileResult> {
    const file = await this.db.query.agentDeskFiles.findFirst({
      where: eq(agentDeskFiles.id, fileId),
    });
    if (!file) throw new Error(`File not found: ${fileId}`);

    let content = "";
    let metadata: ParsedFileResult["metadata"] = {};

    try {
      const response = await fetch(file.storageUrl);
      const buffer = Buffer.from(await response.arrayBuffer());

      if (file.mimeType === "application/pdf") {
        const result = await this.parsePdf(buffer);
        content = result.content;
        metadata = { pageCount: result.pageCount };
      } else if (
        file.mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation"
      ) {
        const result = await this.parsePptx(buffer);
        content = result.content;
        metadata = { slideCount: result.slideCount };
      } else if (file.mimeType.startsWith("image/")) {
        const description = await this.parseImage(buffer, file.mimeType);
        content = description;
        metadata = { imageDescription: description };
      } else if (
        file.mimeType === "text/markdown" ||
        file.mimeType === "text/plain" ||
        file.originalName.endsWith(".md") ||
        file.originalName.endsWith(".txt")
      ) {
        content = buffer.toString("utf-8");
      } else {
        content = buffer.toString("utf-8");
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error("File parsing failed", {
        "agent_desk.file_id": fileId,
        "agent_desk.file_name": file.originalName,
        "error.message": errMsg,
      });
      content = `[파일 파싱 실패: ${file.originalName}] ${errMsg}`;
    }

    // DB 업데이트
    await this.db
      .update(agentDeskFiles)
      .set({ parsedContent: content, parsedAt: new Date() })
      .where(eq(agentDeskFiles.id, fileId));

    logger.info("File parsed", {
      "agent_desk.file_id": fileId,
      "agent_desk.file_name": file.originalName,
      "agent_desk.content_length": content.length,
    });

    return {
      fileId,
      fileName: file.originalName,
      mimeType: file.mimeType,
      content,
      metadata,
    };
  }

  private async parsePdf(buffer: Buffer): Promise<{ content: string; pageCount: number }> {
    const pdfParse = (await import("pdf-parse")).default;
    const result = await pdfParse(buffer);
    return { content: result.text, pageCount: result.numpages };
  }

  private async parsePptx(buffer: Buffer): Promise<{ content: string; slideCount: number }> {
    // PPTX는 ZIP 파일 — slide XML에서 텍스트 추출
    // 간단한 구현: LLM에 base64로 전달하거나, 텍스트 추출 라이브러리 사용
    // Phase 1 MVP에서는 LLM 멀티모달로 처리
    const base64 = buffer.toString("base64");
    const description = await this.llmService.chatCompletion([
      {
        role: "system",
        content: "이 PPTX 파일의 내용을 텍스트로 추출해주세요. 슬라이드별로 구분하여 모든 텍스트를 포함하세요.",
      },
      {
        role: "user",
        content: `PPTX 파일 (base64): ${base64.slice(0, 50000)}`,
      },
    ]);
    return { content: description, slideCount: 0 };
  }

  private async parseImage(buffer: Buffer, mimeType: string): Promise<string> {
    // LLMService 멀티모달로 이미지 분석
    // Phase 1: chatCompletion에 이미지 설명 요청
    const base64 = buffer.toString("base64");
    const description = await this.llmService.chatCompletion([
      {
        role: "system",
        content: "이 이미지의 내용을 상세히 설명해주세요. 텍스트, 다이어그램, UI 화면 등 모든 정보를 추출하세요.",
      },
      {
        role: "user",
        content: `이미지 (${mimeType}, base64): ${base64.slice(0, 100000)}`,
      },
    ]);
    return description;
  }
}
```

**Step 3: Commit**

```bash
git add packages/features/agent-desk/service/file-parser.service.ts
git commit -m "feat(agent-desk): FileParserService — PDF/PPTX/이미지/MD/TXT 파싱"
```

---

### Task 4: AnalysisSessionService 구현

**Files:**
- Create: `packages/features/agent-desk/service/session.service.ts`

**Step 1: 서비스 구현**

```typescript
// packages/features/agent-desk/service/session.service.ts
import { Injectable, NotFoundException } from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import { InjectDrizzle, type DrizzleDB } from "@repo/drizzle";
import {
  agentDeskSessions,
  agentDeskFiles,
  agentDeskMessages,
} from "@repo/drizzle";
import { createLogger } from "@repo/core/logger";
import type { CreateSessionDto } from "../dto/create-session.dto";
import type { ConfirmUploadDto } from "../dto/upload-file.dto";
import type { SessionStatus } from "../types";

const logger = createLogger("agent-desk");

@Injectable()
export class SessionService {
  constructor(@InjectDrizzle() private readonly db: DrizzleDB) {}

  async create(input: CreateSessionDto, userId: string) {
    const [session] = await this.db
      .insert(agentDeskSessions)
      .values({
        type: input.type,
        title: input.title,
        prompt: input.prompt,
        createdById: userId,
      })
      .returning();

    logger.info("Session created", {
      "agent_desk.session_id": session.id,
      "agent_desk.type": input.type,
      "user.id": userId,
    });

    return session;
  }

  async findById(id: string) {
    const session = await this.db.query.agentDeskSessions.findFirst({
      where: eq(agentDeskSessions.id, id),
    });
    if (!session) throw new NotFoundException(`Session not found: ${id}`);
    return session;
  }

  async findByIdWithRelations(id: string) {
    const session = await this.findById(id);
    const [files, messages] = await Promise.all([
      this.db.query.agentDeskFiles.findMany({
        where: eq(agentDeskFiles.sessionId, id),
        orderBy: [desc(agentDeskFiles.createdAt)],
      }),
      this.db.query.agentDeskMessages.findMany({
        where: eq(agentDeskMessages.sessionId, id),
        orderBy: [agentDeskMessages.createdAt],
      }),
    ]);
    return { ...session, files, messages };
  }

  async listByUser(userId: string, type?: "customer" | "operator") {
    const conditions = [eq(agentDeskSessions.createdById, userId)];
    if (type) conditions.push(eq(agentDeskSessions.type, type));

    return this.db.query.agentDeskSessions.findMany({
      where: and(...conditions),
      orderBy: [desc(agentDeskSessions.createdAt)],
    });
  }

  async updateStatus(id: string, status: SessionStatus) {
    await this.findById(id);
    const [updated] = await this.db
      .update(agentDeskSessions)
      .set({ status })
      .where(eq(agentDeskSessions.id, id))
      .returning();

    logger.info("Session status updated", {
      "agent_desk.session_id": id,
      "agent_desk.status": status,
    });

    return updated;
  }

  async delete(id: string) {
    await this.findById(id);
    await this.db.delete(agentDeskSessions).where(eq(agentDeskSessions.id, id));

    logger.info("Session deleted", { "agent_desk.session_id": id });
    return { success: true };
  }

  // === Files ===

  async addFile(input: ConfirmUploadDto) {
    const [file] = await this.db
      .insert(agentDeskFiles)
      .values({
        sessionId: input.sessionId,
        fileName: input.fileName,
        originalName: input.originalName,
        mimeType: input.mimeType,
        size: input.size,
        storageUrl: input.storageUrl,
      })
      .returning();

    logger.info("File added to session", {
      "agent_desk.session_id": input.sessionId,
      "agent_desk.file_id": file.id,
      "agent_desk.file_name": input.originalName,
    });

    return file;
  }

  async removeFile(fileId: string) {
    await this.db.delete(agentDeskFiles).where(eq(agentDeskFiles.id, fileId));
    return { success: true };
  }

  async getFiles(sessionId: string) {
    return this.db.query.agentDeskFiles.findMany({
      where: eq(agentDeskFiles.sessionId, sessionId),
      orderBy: [desc(agentDeskFiles.createdAt)],
    });
  }

  // === Messages ===

  async addMessage(sessionId: string, role: "agent" | "user", content: string) {
    const [message] = await this.db
      .insert(agentDeskMessages)
      .values({ sessionId, role, content })
      .returning();
    return message;
  }

  async getMessages(sessionId: string) {
    return this.db.query.agentDeskMessages.findMany({
      where: eq(agentDeskMessages.sessionId, sessionId),
      orderBy: [agentDeskMessages.createdAt],
    });
  }
}
```

**Step 2: Commit**

```bash
git add packages/features/agent-desk/service/session.service.ts
git commit -m "feat(agent-desk): SessionService — 세션/파일/메시지 CRUD"
```

---

### Task 5: 에이전트 대화 엔진 (ChatService)

**Files:**
- Create: `packages/features/agent-desk/service/chat.service.ts`
- Create: `packages/features/agent-desk/prompts/index.ts`

**Step 1: 시스템 프롬프트 정의**

```typescript
// packages/features/agent-desk/prompts/index.ts
import * as fs from "node:fs";
import * as path from "node:path";

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
4. 충분한 정보가 모이면 "분석을 진행할까요?"라고 제안합니다.

## 응답 규칙
- 한국어로 응답합니다.
- 간결하고 명확하게 응답합니다.
- 한 번에 하나의 질문만 합니다.
- 기술 용어보다 비즈니스 용어를 사용합니다.`;

export const OPERATOR_SYSTEM_PROMPT = `당신은 Product Builder의 Feature 개발 분석 에이전트입니다.

## 역할
- 운영자가 추가하려는 기능의 요구사항을 분석합니다.
- 업로드된 파일(기획서, 설계서, 참고자료)을 분석하여 구현 범위를 정리합니다.
- Atlas의 기존 Feature와 비교하여 gap을 식별합니다.
- 구현에 필요한 기술적 접근 방향을 제안합니다.

## 대화 가이드
1. 어떤 기능을 추가하려는지 질문합니다.
2. 파일이 업로드되면 기술적 관점에서 분석합니다.
3. 기존 Feature와의 관계, 의존성을 파악합니다.
4. 충분한 정보가 모이면 "gap 분석을 진행할까요?"라고 제안합니다.

## 응답 규칙
- 한국어로 응답합니다.
- 기술적 세부사항을 포함합니다.
- Atlas의 아키텍처(Feature 격리, tRPC+REST, Drizzle 스키마)를 고려합니다.`;

export const INITIAL_CUSTOMER_MESSAGE = "안녕하세요! 어떤 서비스를 만들고 싶으신가요? 기획서나 참고 자료가 있다면 아래에 올려주시고, 자유롭게 설명해주세요.";

export const INITIAL_OPERATOR_MESSAGE = "안녕하세요! 어떤 기능을 추가하려고 하시나요? 기획서나 설계 자료가 있다면 올려주시고, 구현하려는 기능을 설명해주세요.";

export function getFeatureRegistrySummary(): string {
  try {
    const registryPath = path.resolve(process.cwd(), "../../registry/features.json");
    const raw = fs.readFileSync(registryPath, "utf-8");
    const registry = JSON.parse(raw);
    const features = Object.entries(registry.features ?? {})
      .map(([id, f]: [string, any]) => `- ${id}: ${f.name} — ${f.description ?? ""}`)
      .join("\n");
    return `## 현재 Product Builder에 구현된 Features\n${features}`;
  } catch {
    return "## Features 레지스트리를 읽을 수 없습니다.";
  }
}
```

**Step 2: ChatService 구현**

```typescript
// packages/features/agent-desk/service/chat.service.ts
import { Injectable } from "@nestjs/common";
import { createLogger } from "@repo/core/logger";
import type { LLMService } from "../../ai/service/llm.service";
import { SessionService } from "./session.service";
import {
  CUSTOMER_SYSTEM_PROMPT,
  OPERATOR_SYSTEM_PROMPT,
  INITIAL_CUSTOMER_MESSAGE,
  INITIAL_OPERATOR_MESSAGE,
  getFeatureRegistrySummary,
} from "../prompts";
import type { ChatMessage } from "../types";

const logger = createLogger("agent-desk");

@Injectable()
export class ChatService {
  private llmService!: LLMService;

  constructor(private readonly sessionService: SessionService) {}

  setLLMService(service: LLMService) {
    this.llmService = service;
  }

  getInitialMessage(type: "customer" | "operator"): string {
    return type === "customer" ? INITIAL_CUSTOMER_MESSAGE : INITIAL_OPERATOR_MESSAGE;
  }

  async handleUserMessage(sessionId: string, content: string): Promise<string> {
    // 1. 사용자 메시지 저장
    await this.sessionService.addMessage(sessionId, "user", content);

    // 2. 컨텍스트 수집
    const session = await this.sessionService.findByIdWithRelations(sessionId);

    // 3. LLM 메시지 빌드
    const messages = this.buildLLMMessages(session);

    // 4. LLM 호출
    const response = await this.llmService.chatCompletion(messages);

    // 5. 에이전트 응답 저장
    await this.sessionService.addMessage(sessionId, "agent", response);

    logger.info("Chat message processed", {
      "agent_desk.session_id": sessionId,
      "agent_desk.user_message_length": content.length,
      "agent_desk.agent_response_length": response.length,
    });

    return response;
  }

  async *handleUserMessageStream(sessionId: string, content: string): AsyncGenerator<string> {
    // 1. 사용자 메시지 저장
    await this.sessionService.addMessage(sessionId, "user", content);

    // 2. 컨텍스트 수집
    const session = await this.sessionService.findByIdWithRelations(sessionId);

    // 3. LLM 메시지 빌드
    const messages = this.buildLLMMessages(session);

    // 4. LLM 스트리밍 호출
    let fullResponse = "";
    for await (const chunk of this.llmService.chatCompletionStream(messages)) {
      fullResponse += chunk;
      yield chunk;
    }

    // 5. 에이전트 응답 저장
    await this.sessionService.addMessage(sessionId, "agent", fullResponse);

    logger.info("Chat stream completed", {
      "agent_desk.session_id": sessionId,
      "agent_desk.response_length": fullResponse.length,
    });
  }

  private buildLLMMessages(session: {
    type: string;
    files: Array<{ parsedContent: string | null; originalName: string }>;
    messages: Array<{ role: string; content: string }>;
  }): ChatMessage[] {
    const systemPrompt = session.type === "customer"
      ? CUSTOMER_SYSTEM_PROMPT
      : OPERATOR_SYSTEM_PROMPT;

    const featureContext = getFeatureRegistrySummary();

    const fileContext = session.files
      .filter((f) => f.parsedContent)
      .map((f) => `[${f.originalName}]\n${f.parsedContent!.slice(0, 5000)}`)
      .join("\n\n");

    const systemMessage = [
      systemPrompt,
      featureContext,
      fileContext ? `## 업로드된 파일 내용\n${fileContext}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const chatHistory: ChatMessage[] = session.messages.map((m) => ({
      role: m.role === "agent" ? "assistant" as const : "user" as const,
      content: m.content,
    }));

    return [{ role: "system", content: systemMessage }, ...chatHistory];
  }
}
```

**Step 3: Commit**

```bash
git add packages/features/agent-desk/service/chat.service.ts packages/features/agent-desk/prompts/
git commit -m "feat(agent-desk): ChatService + 시스템 프롬프트 — 에이전트 대화 엔진"
```

---

### Task 6: tRPC Router

**Files:**
- Create: `packages/features/agent-desk/trpc/index.ts`
- Create: `packages/features/agent-desk/trpc/agent-desk.route.ts`

**Step 1: tRPC 라우터 구현**

```typescript
// packages/features/agent-desk/trpc/agent-desk.route.ts
import { z } from "zod";
import {
  router,
  publicProcedure,
  authProcedure,
  protectedProcedure,
  adminProcedure,
  getAuthUserId,
  createServiceContainer,
} from "@repo/core/trpc";
import type { SessionService } from "../service/session.service";
import type { ChatService } from "../service/chat.service";
import type { FileParserService } from "../service/file-parser.service";
import { createSessionSchema } from "../dto/create-session.dto";
import { sendMessageSchema } from "../dto/send-message.dto";
import { confirmUploadSchema } from "../dto/upload-file.dto";

const services = createServiceContainer<{
  sessionService: SessionService;
  chatService: ChatService;
  fileParserService: FileParserService;
}>();

export const injectAgentDeskServices = services.inject;

export const agentDeskRouter = router({
  // === 세션 ===
  createSession: protectedProcedure
    .input(createSessionSchema)
    .mutation(async ({ input, ctx }) => {
      const userId = getAuthUserId(ctx);
      const session = await services.get().sessionService.create(input, userId);
      // 에이전트 초기 메시지 저장
      const initialMsg = services.get().chatService.getInitialMessage(input.type);
      await services.get().sessionService.addMessage(session.id, "agent", initialMsg);
      return session;
    }),

  getSession: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      return services.get().sessionService.findByIdWithRelations(input.id);
    }),

  listSessions: protectedProcedure
    .input(z.object({
      type: z.enum(["customer", "operator"]).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const userId = getAuthUserId(ctx);
      return services.get().sessionService.listByUser(userId, input?.type);
    }),

  deleteSession: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      return services.get().sessionService.delete(input.id);
    }),

  // === 파일 ===
  confirmUpload: protectedProcedure
    .input(confirmUploadSchema)
    .mutation(async ({ input }) => {
      const file = await services.get().sessionService.addFile(input);
      // 비동기 파싱 시작
      services.get().fileParserService.parseFile(file.id).catch(() => {});
      return file;
    }),

  removeFile: protectedProcedure
    .input(z.object({ fileId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      return services.get().sessionService.removeFile(input.fileId);
    }),

  getFiles: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .query(async ({ input }) => {
      return services.get().sessionService.getFiles(input.sessionId);
    }),

  // === 대화 ===
  sendMessage: protectedProcedure
    .input(sendMessageSchema)
    .mutation(async ({ input }) => {
      const response = await services.get().chatService.handleUserMessage(
        input.sessionId,
        input.content,
      );
      return { response };
    }),

  getMessages: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .query(async ({ input }) => {
      return services.get().sessionService.getMessages(input.sessionId);
    }),
});

export type AgentDeskRouter = typeof agentDeskRouter;
```

```typescript
// packages/features/agent-desk/trpc/index.ts
export { agentDeskRouter, injectAgentDeskServices, type AgentDeskRouter } from "./agent-desk.route";
```

**Step 2: Commit**

```bash
git add packages/features/agent-desk/trpc/
git commit -m "feat(agent-desk): tRPC Router — 세션/파일/대화 프로시저"
```

---

### Task 7: REST Controller + Swagger

**Files:**
- Create: `packages/features/agent-desk/controller/agent-desk.controller.ts`

**Step 1: REST Controller 구현**

```typescript
// packages/features/agent-desk/controller/agent-desk.controller.ts
import {
  Controller, Get, Post, Delete, Body, Param, Query,
  ParseUUIDPipe, UseGuards, Sse, MessageEvent,
} from "@nestjs/common";
import {
  ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery,
} from "@nestjs/swagger";
import { JwtAuthGuard, CurrentUser, type User } from "@repo/core/nestjs/auth";
import { Observable } from "rxjs";
import { SessionService } from "../service/session.service";
import { ChatService } from "../service/chat.service";
import { FileParserService } from "../service/file-parser.service";
import type { CreateSessionDto } from "../dto/create-session.dto";
import type { SendMessageDto } from "../dto/send-message.dto";
import type { ConfirmUploadDto } from "../dto/upload-file.dto";

@ApiTags("Agent Desk")
@Controller("agent-desk")
export class AgentDeskController {
  constructor(
    private readonly sessionService: SessionService,
    private readonly chatService: ChatService,
    private readonly fileParserService: FileParserService,
  ) {}

  // === 세션 ===

  @Post("sessions")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "분석 세션 생성" })
  @ApiResponse({ status: 201, description: "세션 생성 성공" })
  async createSession(@Body() dto: CreateSessionDto, @CurrentUser() user: User) {
    const session = await this.sessionService.create(dto, user.id);
    const initialMsg = this.chatService.getInitialMessage(dto.type);
    await this.sessionService.addMessage(session.id, "agent", initialMsg);
    return session;
  }

  @Get("sessions")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "세션 목록 조회" })
  @ApiQuery({ name: "type", required: false, enum: ["customer", "operator"] })
  @ApiResponse({ status: 200, description: "세션 목록" })
  async listSessions(
    @CurrentUser() user: User,
    @Query("type") type?: "customer" | "operator",
  ) {
    return this.sessionService.listByUser(user.id, type);
  }

  @Get("sessions/:id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "세션 상세 조회" })
  @ApiParam({ name: "id", description: "세션 UUID" })
  @ApiResponse({ status: 200, description: "세션 상세 (파일, 메시지 포함)" })
  async getSession(@Param("id", ParseUUIDPipe) id: string) {
    return this.sessionService.findByIdWithRelations(id);
  }

  @Delete("sessions/:id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "세션 삭제" })
  @ApiParam({ name: "id", description: "세션 UUID" })
  @ApiResponse({ status: 200, description: "삭제 성공" })
  async deleteSession(@Param("id", ParseUUIDPipe) id: string) {
    return this.sessionService.delete(id);
  }

  // === 파일 ===

  @Post("files")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "파일 업로드 확인" })
  @ApiResponse({ status: 201, description: "파일 등록 + 파싱 시작" })
  async confirmUpload(@Body() dto: ConfirmUploadDto) {
    const file = await this.sessionService.addFile(dto);
    this.fileParserService.parseFile(file.id).catch(() => {});
    return file;
  }

  @Delete("files/:fileId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "파일 삭제" })
  @ApiParam({ name: "fileId", description: "파일 UUID" })
  @ApiResponse({ status: 200, description: "삭제 성공" })
  async removeFile(@Param("fileId", ParseUUIDPipe) fileId: string) {
    return this.sessionService.removeFile(fileId);
  }

  // === 대화 ===

  @Post("sessions/:id/messages")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "메시지 전송 (에이전트 응답 포함)" })
  @ApiParam({ name: "id", description: "세션 UUID" })
  @ApiResponse({ status: 200, description: "에이전트 응답" })
  async sendMessage(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: { content: string },
  ) {
    const response = await this.chatService.handleUserMessage(id, dto.content);
    return { response };
  }

  @Get("sessions/:id/messages")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "메시지 목록 조회" })
  @ApiParam({ name: "id", description: "세션 UUID" })
  @ApiResponse({ status: 200, description: "메시지 목록" })
  async getMessages(@Param("id", ParseUUIDPipe) id: string) {
    return this.sessionService.getMessages(id);
  }

  // === SSE 스트리밍 ===

  @Get("sessions/:id/chat/stream")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "대화 응답 SSE 스트리밍" })
  @Sse()
  chatStream(
    @Param("id", ParseUUIDPipe) sessionId: string,
    @Query("message") message: string,
  ): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          for await (const chunk of this.chatService.handleUserMessageStream(sessionId, message)) {
            subscriber.next({ data: JSON.stringify({ chunk }) } as MessageEvent);
          }
          subscriber.next({ data: JSON.stringify({ done: true }) } as MessageEvent);
          subscriber.complete();
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }
}
```

**Step 2: Commit**

```bash
git add packages/features/agent-desk/controller/
git commit -m "feat(agent-desk): REST Controller + Swagger + SSE 스트리밍"
```

---

### Task 8: NestJS Module + 서버 등록

**Files:**
- Create: `packages/features/agent-desk/agent-desk.module.ts`
- Create: `packages/features/agent-desk/service/index.ts`
- Modify: `packages/features/app-router.ts`
- Modify: `apps/server/src/trpc/router.ts`
- Modify: `apps/server/src/app.module.ts`

**Step 1: Service index**

```typescript
// packages/features/agent-desk/service/index.ts
export { SessionService } from "./session.service";
export { ChatService } from "./chat.service";
export { FileParserService } from "./file-parser.service";
```

**Step 2: Module 정의**

```typescript
// packages/features/agent-desk/agent-desk.module.ts
import { Module, OnModuleInit } from "@nestjs/common";
import { SessionService } from "./service/session.service";
import { ChatService } from "./service/chat.service";
import { FileParserService } from "./service/file-parser.service";
import { AgentDeskController } from "./controller/agent-desk.controller";
import { injectAgentDeskServices } from "./trpc";
import { LLMService } from "../ai/service/llm.service";

@Module({
  controllers: [AgentDeskController],
  providers: [SessionService, ChatService, FileParserService, LLMService],
  exports: [SessionService, ChatService, FileParserService],
})
export class AgentDeskModule implements OnModuleInit {
  constructor(
    private readonly sessionService: SessionService,
    private readonly chatService: ChatService,
    private readonly fileParserService: FileParserService,
    private readonly llmService: LLMService,
  ) {}

  onModuleInit() {
    this.chatService.setLLMService(this.llmService);
    this.fileParserService.setLLMService(this.llmService);
    injectAgentDeskServices({
      sessionService: this.sessionService,
      chatService: this.chatService,
      fileParserService: this.fileParserService,
    });
  }
}
```

**Step 3: app-router.ts에 타입 추가**

`packages/features/app-router.ts`에 import + 라우터 키 추가:
```typescript
import { agentDeskRouter } from './agent-desk';
// _appRouter의 router({}) 안에 추가:
agentDesk: agentDeskRouter,
```

**Step 4: trpc/router.ts에 런타임 추가**

`apps/server/src/trpc/router.ts`에 import + 라우터 키 추가:
```typescript
import { agentDeskRouter } from '@repo/features/agent-desk';
// trpcRouter의 router({}) 안에 추가:
agentDesk: agentDeskRouter,
```

**Step 5: app.module.ts에 Module 추가**

`apps/server/src/app.module.ts`에:
```typescript
import { AgentDeskModule } from '@repo/features/agent-desk';
// [ATLAS:MODULES] 안에 추가:
AgentDeskModule,
```

**Step 6: TypeScript 빌드 확인**

Run: `cd apps/server && pnpm tsc --noEmit`

**Step 7: Commit**

```bash
git add packages/features/agent-desk/ packages/features/app-router.ts apps/server/src/
git commit -m "feat(agent-desk): Module 정의 + 서버 등록 (NestJS, tRPC, Schema)"
```

---

### Task 9: 클라이언트 Feature 구조 + Hooks

**Files:**
- Create: `apps/app/src/features/agent-desk/index.ts`
- Create: `apps/app/src/features/agent-desk/hooks/use-agent-desk-sessions.ts`
- Create: `apps/app/src/features/agent-desk/hooks/use-chat.ts`
- Create: `apps/app/src/features/agent-desk/hooks/use-file-upload.ts`
- Create: `apps/app/src/features/agent-desk/store/agent-desk.store.ts`

**Step 1: Hooks 구현**

```typescript
// apps/app/src/features/agent-desk/hooks/use-agent-desk-sessions.ts
import { useTRPC } from "../../../lib/trpc";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useAgentDeskSessions(type?: "customer" | "operator") {
  const trpc = useTRPC();
  return useQuery(trpc.agentDesk.listSessions.queryOptions({ type }));
}

export function useAgentDeskSession(id: string) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.agentDesk.getSession.queryOptions({ id }),
    enabled: !!id,
  });
}

export function useCreateSession() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.agentDesk.createSession.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.agentDesk.listSessions.queryKey() });
    },
  });
}

export function useDeleteSession() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.agentDesk.deleteSession.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.agentDesk.listSessions.queryKey() });
    },
  });
}
```

```typescript
// apps/app/src/features/agent-desk/hooks/use-chat.ts
import { useTRPC } from "../../../lib/trpc";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useMessages(sessionId: string) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.agentDesk.getMessages.queryOptions({ sessionId }),
    enabled: !!sessionId,
    refetchInterval: false,
  });
}

export function useSendMessage() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.agentDesk.sendMessage.mutationOptions(),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: trpc.agentDesk.getMessages.queryKey({ sessionId: variables.sessionId }),
      });
    },
  });
}
```

```typescript
// apps/app/src/features/agent-desk/hooks/use-file-upload.ts
import { useTRPC } from "../../../lib/trpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useConfirmUpload() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation({
    ...trpc.agentDesk.confirmUpload.mutationOptions(),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: trpc.agentDesk.getSession.queryKey({ id: variables.sessionId }),
      });
    },
  });
}

export function useRemoveFile() {
  const trpc = useTRPC();
  return useMutation({
    ...trpc.agentDesk.removeFile.mutationOptions(),
  });
}
```

```typescript
// apps/app/src/features/agent-desk/store/agent-desk.store.ts
import { atom } from "jotai";

export const chatInputAtom = atom("");
export const isStreamingAtom = atom(false);
```

**Step 2: Commit**

```bash
git add apps/app/src/features/agent-desk/
git commit -m "feat(agent-desk): 클라이언트 hooks + store — 세션/대화/파일"
```

---

### Task 10: 채팅 UI 컴포넌트

**Files:**
- Create: `apps/app/src/features/agent-desk/components/chat-message.tsx`
- Create: `apps/app/src/features/agent-desk/components/chat-input.tsx`
- Create: `apps/app/src/features/agent-desk/components/file-upload-zone.tsx`
- Create: `apps/app/src/features/agent-desk/components/session-history-list.tsx`

**Step 1: ChatMessage 컴포넌트**

```typescript
// apps/app/src/features/agent-desk/components/chat-message.tsx
import { cn } from "@repo/ui/lib/utils";

interface Props {
  role: "agent" | "user";
  content: string;
  createdAt?: string;
}

export function ChatMessage({ role, content, createdAt }: Props) {
  return (
    <div
      className={cn(
        "flex gap-3 px-4 py-3",
        role === "user" ? "flex-row-reverse" : "flex-row"
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-medium",
          role === "agent"
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        )}
      >
        {role === "agent" ? "AI" : "나"}
      </div>
      <div
        className={cn(
          "max-w-[75%] rounded-lg px-4 py-2",
          role === "user"
            ? "bg-primary text-primary-foreground"
            : "bg-muted"
        )}
      >
        <p className="whitespace-pre-wrap text-base">{content}</p>
      </div>
    </div>
  );
}
```

**Step 2: ChatInput 컴포넌트**

```typescript
// apps/app/src/features/agent-desk/components/chat-input.tsx
import { useState } from "react";
import { Button } from "@repo/ui/shadcn/button";
import { Textarea } from "@repo/ui/shadcn/textarea";
import { Send } from "lucide-react";

interface Props {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, disabled, placeholder }: Props) {
  const [value, setValue] = useState("");

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex items-end gap-2 px-4 py-3 border-t border-border">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? "메시지를 입력하세요..."}
        disabled={disabled}
        className="min-h-[44px] max-h-[120px] resize-none"
        rows={1}
      />
      <Button
        onClick={handleSubmit}
        disabled={disabled || !value.trim()}
        size="icon"
        className="shrink-0"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
```

**Step 3: FileUploadZone 컴포넌트**

```typescript
// apps/app/src/features/agent-desk/components/file-upload-zone.tsx
import { useCallback } from "react";
import { Upload, X } from "lucide-react";
import { Button } from "@repo/ui/shadcn/button";
import { cn } from "@repo/ui/lib/utils";

interface UploadedFile {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
}

interface Props {
  files: UploadedFile[];
  onUpload: (file: File) => void;
  onRemove: (fileId: string) => void;
  disabled?: boolean;
}

export function FileUploadZone({ files, onUpload, onRemove, disabled }: Props) {
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (disabled) return;
      const droppedFiles = Array.from(e.dataTransfer.files);
      droppedFiles.forEach((f) => onUpload(f));
    },
    [onUpload, disabled]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files ?? []);
      selectedFiles.forEach((f) => onUpload(f));
      e.target.value = "";
    },
    [onUpload]
  );

  return (
    <div className="border-t border-border px-4 py-3">
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className={cn(
          "flex items-center gap-3 rounded-lg border border-dashed border-border p-3",
          disabled && "opacity-50"
        )}
      >
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <Upload className="h-4 w-4" />
          <span>파일 추가</span>
          <input
            type="file"
            multiple
            accept=".pdf,.pptx,.png,.jpg,.jpeg,.md,.txt"
            onChange={handleChange}
            className="hidden"
            disabled={disabled}
          />
        </label>
        <span className="text-sm text-muted-foreground/70">
          PDF, PPTX, 이미지, MD, TXT
        </span>
      </div>
      {files.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {files.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-sm"
            >
              <span className="max-w-[150px] truncate">{f.originalName}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4"
                onClick={() => onRemove(f.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 4: SessionHistoryList 컴포넌트**

```typescript
// apps/app/src/features/agent-desk/components/session-history-list.tsx
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { cn } from "@repo/ui/lib/utils";

interface Session {
  id: string;
  title: string | null;
  status: string;
  createdAt: string;
}

interface Props {
  sessions: Session[];
  onSelect: (sessionId: string) => void;
}

export function SessionHistoryList({ sessions, onSelect }: Props) {
  if (sessions.length === 0) return null;

  return (
    <div className="px-4 py-3">
      <h3 className="text-sm font-medium text-muted-foreground mb-2">이전 세션</h3>
      <div className="flex flex-col gap-2">
        {sessions.slice(0, 5).map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={cn(
              "flex items-center justify-between rounded-lg px-3 py-2 text-left",
              "bg-muted/30 hover:bg-muted/50 transition-colors"
            )}
          >
            <span className="text-sm truncate">
              {s.title ?? "제목 없음"}
            </span>
            <span className="text-sm text-muted-foreground shrink-0 ml-2">
              {formatDistanceToNow(new Date(s.createdAt), { addSuffix: true, locale: ko })}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

**Step 5: Commit**

```bash
git add apps/app/src/features/agent-desk/components/
git commit -m "feat(agent-desk): 채팅 UI 컴포넌트 — ChatMessage, ChatInput, FileUploadZone, SessionHistory"
```

---

### Task 11: 고객용 대화 페이지 + 라우트

**Files:**
- Create: `apps/app/src/features/agent-desk/pages/customer/agent-desk-chat.tsx`
- Create: `apps/app/src/features/agent-desk/routes/index.ts`
- Create: `apps/app/src/features/agent-desk/routes/customer/chat.tsx`
- Modify: `apps/app/src/features/agent-desk/index.ts`
- Modify: `apps/app/src/router.tsx`

**Step 1: 대화 페이지 구현**

```typescript
// apps/app/src/features/agent-desk/pages/customer/agent-desk-chat.tsx
import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Feature, FeatureHeader, FeatureContents } from "@repo/ui";
import { ChatMessage } from "../../components/chat-message";
import { ChatInput } from "../../components/chat-input";
import { FileUploadZone } from "../../components/file-upload-zone";
import { SessionHistoryList } from "../../components/session-history-list";
import {
  useAgentDeskSession,
  useAgentDeskSessions,
  useCreateSession,
} from "../../hooks/use-agent-desk-sessions";
import { useMessages, useSendMessage } from "../../hooks/use-chat";
import { useConfirmUpload, useRemoveFile } from "../../hooks/use-file-upload";

interface Props {
  sessionId?: string;
}

export function AgentDeskChat({ sessionId: initialSessionId }: Props) {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);

  // 세션 관리
  const createSession = useCreateSession();
  const { data: sessions } = useAgentDeskSessions("customer");
  const { data: session } = useAgentDeskSession(initialSessionId ?? "");

  // 대화
  const { data: messages } = useMessages(initialSessionId ?? "");
  const sendMessage = useSendMessage();

  // 파일
  const confirmUpload = useConfirmUpload();
  const removeFile = useRemoveFile();

  // 자동 스크롤
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // 세션 없으면 새로 생성
  useEffect(() => {
    if (!initialSessionId) {
      createSession.mutate(
        { type: "customer" },
        {
          onSuccess: (newSession) => {
            navigate({ to: "/agent-desk", search: { session: newSession.id } });
          },
        }
      );
    }
  }, [initialSessionId]);

  const handleSend = (content: string) => {
    if (!initialSessionId) return;
    sendMessage.mutate({ sessionId: initialSessionId, content });
  };

  const handleFileUpload = async (file: File) => {
    if (!initialSessionId) return;
    // TODO: Supabase Storage 업로드 후 confirmUpload 호출
    // Phase 1 MVP에서는 placeholder
  };

  const handleFileRemove = (fileId: string) => {
    removeFile.mutate({ fileId });
  };

  return (
    <Feature className="h-full">
      <FeatureHeader title="서비스 만들기" />
      <FeatureContents className="flex flex-col p-0" padding="none">
        {/* 채팅 영역 */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {messages?.map((m) => (
            <ChatMessage key={m.id} role={m.role as "agent" | "user"} content={m.content} />
          ))}
          {sendMessage.isPending && (
            <div className="px-4 py-3 text-sm text-muted-foreground">에이전트가 응답 중...</div>
          )}
        </div>

        {/* 이전 세션 */}
        {sessions && sessions.length > 0 && (
          <SessionHistoryList
            sessions={sessions}
            onSelect={(id) => navigate({ to: "/agent-desk", search: { session: id } })}
          />
        )}

        {/* 파일 업로드 */}
        <FileUploadZone
          files={session?.files ?? []}
          onUpload={handleFileUpload}
          onRemove={handleFileRemove}
        />

        {/* 입력 */}
        <ChatInput
          onSend={handleSend}
          disabled={sendMessage.isPending || !initialSessionId}
        />
      </FeatureContents>
    </Feature>
  );
}
```

**Step 2: 라우트 정의**

```typescript
// apps/app/src/features/agent-desk/routes/customer/chat.tsx
import { createRoute } from "@tanstack/react-router";
import type { AnyRoute } from "@tanstack/react-router";
import { AgentDeskChat } from "../../pages/customer/agent-desk-chat";
import { z } from "zod";

const searchSchema = z.object({
  session: z.string().uuid().optional(),
});

export const createAgentDeskChatRoute = <T extends AnyRoute>(parentRoute: T) =>
  createRoute({
    getParentRoute: () => parentRoute,
    path: "/agent-desk",
    component: () => {
      const { session } = createAgentDeskChatRoute(parentRoute).useSearch();
      return <AgentDeskChat sessionId={session} />;
    },
    validateSearch: searchSchema,
  });
```

```typescript
// apps/app/src/features/agent-desk/routes/index.ts
import type { AnyRoute } from "@tanstack/react-router";
import { createAgentDeskChatRoute } from "./customer/chat";

export const AGENT_DESK_PATH = "/agent-desk";

export function createAgentDeskRoutes<T extends AnyRoute>(parentRoute: T) {
  return [createAgentDeskChatRoute(parentRoute)];
}
```

**Step 3: Feature index.ts**

```typescript
// apps/app/src/features/agent-desk/index.ts
export { createAgentDeskRoutes, AGENT_DESK_PATH } from "./routes";
```

**Step 4: router.tsx에 등록**

`apps/app/src/router.tsx`의 appLayoutRoute.addChildren 안에 추가:
```typescript
import { createAgentDeskRoutes } from "./features/agent-desk";
// appLayoutRoute.addChildren([...]) 안에:
...createAgentDeskRoutes(appLayoutRoute),
```

**Step 5: TypeScript 빌드 확인**

Run: `cd apps/app && pnpm tsc --noEmit`

**Step 6: Commit**

```bash
git add apps/app/src/features/agent-desk/ apps/app/src/router.tsx
git commit -m "feat(agent-desk): 고객용 채팅 페이지 + 라우트 등록"
```

---

## Phase 2: Feature 분석 리포트

### Task 12: analyses 테이블 추가

**Files:**
- Modify: `packages/drizzle/src/schema/features/agent-desk/index.ts`

analyses 테이블, 관련 타입을 스키마에 추가. Migration 생성.

---

### Task 13: FeatureAnalyzerService 구현

**Files:**
- Create: `packages/features/agent-desk/service/feature-analyzer.service.ts`

Feature Registry(`registry/features.json`) + Reference 문서(`docs/reference/`) 읽기 → LLM `structuredCompletion` 호출 → 요구사항 추출 + 매칭/gap 분석. AnalysisResult 타입 반환.

---

### Task 14: 분석 tRPC/REST 프로시저 추가

**Files:**
- Modify: `packages/features/agent-desk/trpc/agent-desk.route.ts` — `startAnalysis`, `getAnalysis` 프로시저 추가
- Modify: `packages/features/agent-desk/controller/agent-desk.controller.ts` — POST/GET 엔드포인트 추가

---

### Task 15: 분석 리포트 UI

**Files:**
- Create: `apps/app/src/features/agent-desk/components/analysis-summary.tsx`
- Create: `apps/app/src/features/agent-desk/components/matched-feature-list.tsx`
- Create: `apps/app/src/features/agent-desk/components/missing-feature-list.tsx`
- Create: `apps/app/src/features/agent-desk/pages/customer/agent-desk-analysis.tsx`
- Create: `apps/app/src/features/agent-desk/routes/customer/analysis.tsx`
- Modify: `apps/app/src/features/agent-desk/routes/index.ts`
- Create: `apps/app/src/features/agent-desk/hooks/use-analysis.ts`

---

## Phase 3: 스펙 생성 + 프로젝트 Scaffold

### Task 16: specs, projects 테이블 추가

**Files:**
- Modify: `packages/drizzle/src/schema/features/agent-desk/index.ts`

---

### Task 17: SpecGeneratorService 구현

**Files:**
- Create: `packages/features/agent-desk/service/spec-generator.service.ts`

매칭된 features + 사용자 조정 → 프로젝트 스펙 JSON 생성. LLM으로 라우트/메뉴/테마 자동 제안.

---

### Task 18: ProjectScaffoldService 구현

**Files:**
- Create: `packages/features/agent-desk/service/project-scaffold.service.ts`
- Create: `packages/features/agent-desk/templates/` — scaffold 템플릿 파일들

스펙 JSON → `apps/projects/{name}/` 디렉토리 생성. package.json, router.tsx, feature-config.ts, layout 등 생성.

---

### Task 19: 스펙/프로젝트 tRPC/REST + UI

**Files:**
- 스펙/프로젝트 프로시저 추가
- 스펙 편집 UI, 프로젝트 결과 UI, 관련 hooks, 라우트 추가

---

## Phase 4: 운영자 도구

### Task 20: executions 테이블 추가

**Files:**
- Modify: `packages/drizzle/src/schema/features/agent-desk/index.ts`

---

### Task 21: ClaudeExecutorService 구현

**Files:**
- Create: `packages/features/agent-desk/service/claude-executor.service.ts`

Claude Code CLI를 `child_process.spawn`으로 실행. stdout/stderr 캡처 → DB 저장 + SSE 스트리밍. 타임아웃(30분), 취소(SIGTERM) 지원.

---

### Task 22: 구현 프롬프트 생성기

**Files:**
- Create: `packages/features/agent-desk/prompts/implementation.ts`

missing features → Product Builder 규칙(`feature/steps.md`) 기반 구현 프롬프트 자동 생성.

---

### Task 23: 운영자 tRPC/REST + UI

**Files:**
- 실행 관련 프로시저 추가 (adminProcedure)
- 운영자 대화 UI, Gap 분석 리포트 UI, 실행 모니터링 UI, 관련 hooks, 라우트 추가

---

## Phase 5: 고도화 + Admin

### Task 24: Admin 대시보드

**Files:**
- `apps/system-admin/src/features/agent-desk/` — Admin 페이지, 라우트, 메뉴 등록

---

### Task 25: Reference 문서 업데이트

**Files:**
- Modify: `docs/reference/features-backend.md`
- Modify: `docs/reference/features-frontend.md`
- Modify: `docs/reference/database-schema.md`

---

### Task 26: Obsidian 인덱스 업데이트

Obsidian `Product Builder/Features/인덱스.md`에 agent-desk feature 섹션 추가.
