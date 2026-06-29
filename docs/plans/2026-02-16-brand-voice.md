# 브랜드 보이스 & 톤 커스터마이징 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** 스튜디오별 브랜드 프로필 관리 + AI 프롬프트 자동 주입 + 톤 일관성 검사 구현

**Architecture:** `studio_brand_profiles` / `studio_tone_presets` 테이블 추가, `StudioBrandVoiceService` 신규 서비스, `LLMService`에 brandContext 주입 포인트 추가, 기존 `StudioAiSuggestService`에서 브랜드 컨텍스트 로드 후 AI에 전달. 프론트엔드는 스튜디오 설정에 브랜드 보이스 탭 추가, 에디터에 금칙어 검사 UI 추가.

**Tech Stack:** Drizzle ORM, NestJS, tRPC, OpenAI API, React, TanStack Query, Jotai

---

## Task 1: Schema — `studio_brand_profiles` + `studio_tone_presets` 테이블 추가

**Files:**
- Modify: `packages/drizzle/src/schema/features/content-studio/index.ts`

**Changes:**

기존 enums 섹션 바로 아래에 추가:

```typescript
export const studioSentenceLengthEnum = pgEnum("studio_sentence_length", [
  "short",
  "medium",
  "long",
]);
```

기존 Tables 섹션 하단(`studioAiRecurrences` 뒤)에 추가:

```typescript
/**
 * Studio Brand Profiles - 스튜디오별 브랜드 보이스 설정 (1:1)
 */
export const studioBrandProfiles = pgTable(
  "studio_brand_profiles",
  {
    ...baseColumns(),

    studioId: uuid("studio_id")
      .notNull()
      .unique()
      .references(() => studioStudios.id, { onDelete: "cascade" }),

    brandName: varchar("brand_name", { length: 100 }).notNull(),
    industry: varchar("industry", { length: 100 }),
    targetAudience: text("target_audience"),

    formality: integer("formality").notNull().default(3),
    friendliness: integer("friendliness").notNull().default(3),
    humor: integer("humor").notNull().default(2),
    sentenceLength: studioSentenceLengthEnum("sentence_length")
      .notNull()
      .default("medium"),

    forbiddenWords: text("forbidden_words").array().default([]),
    requiredWords: text("required_words").array().default([]),
    additionalGuidelines: text("additional_guidelines"),

    activePresetId: uuid("active_preset_id"),
  },
  (table) => [
    index("idx_studio_brand_profiles_studio").on(table.studioId),
  ],
);

/**
 * Studio Tone Presets - 톤 프리셋 (시스템 + 커스텀)
 */
export const studioTonePresets = pgTable(
  "studio_tone_presets",
  {
    ...baseColumns(),

    studioId: uuid("studio_id").references(() => studioStudios.id, {
      onDelete: "cascade",
    }),

    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),

    formality: integer("formality").notNull().default(3),
    friendliness: integer("friendliness").notNull().default(3),
    humor: integer("humor").notNull().default(2),
    sentenceLength: studioSentenceLengthEnum("sentence_length")
      .notNull()
      .default("medium"),

    systemPromptSuffix: text("system_prompt_suffix"),
    isSystem: boolean("is_system").notNull().default(false),
  },
  (table) => [
    index("idx_studio_tone_presets_studio").on(table.studioId),
    index("idx_studio_tone_presets_system").on(table.isSystem),
  ],
);
```

Relations 섹션에 추가:

```typescript
export const studioBrandProfilesRelations = relations(
  studioBrandProfiles,
  ({ one }) => ({
    studio: one(studioStudios, {
      fields: [studioBrandProfiles.studioId],
      references: [studioStudios.id],
    }),
    activePreset: one(studioTonePresets, {
      fields: [studioBrandProfiles.activePresetId],
      references: [studioTonePresets.id],
    }),
  }),
);

export const studioTonePresetsRelations = relations(
  studioTonePresets,
  ({ one }) => ({
    studio: one(studioStudios, {
      fields: [studioTonePresets.studioId],
      references: [studioStudios.id],
    }),
  }),
);
```

`studioStudiosRelations`에 추가:

```typescript
brandProfile: one(studioBrandProfiles),
tonePresets: many(studioTonePresets),
```

Type Exports 섹션에 추가:

```typescript
export type StudioBrandProfile = typeof studioBrandProfiles.$inferSelect;
export type NewStudioBrandProfile = typeof studioBrandProfiles.$inferInsert;

export type StudioTonePreset = typeof studioTonePresets.$inferSelect;
export type NewStudioTonePreset = typeof studioTonePresets.$inferInsert;

export type StudioSentenceLength = "short" | "medium" | "long";
```

**Verification:**
```bash
cd packages/drizzle && pnpm tsc --noEmit
```

---

## Task 2: Service — `StudioBrandVoiceService` 생성

**Files:**
- Create: `packages/features/content-studio/service/studio-brand-voice.service.ts`

**참고 패턴:** `packages/features/content-studio/service/studio-ai-suggest.service.ts` (DI 방식, assertStudioOwner 패턴)

**Changes:**

```typescript
import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common";
import { DRIZZLE } from "@repo/drizzle";
import type { DrizzleDB } from "@repo/drizzle";
import { eq, and, or, isNull } from "drizzle-orm";
import {
  studioStudios,
  studioBrandProfiles,
  studioTonePresets,
} from "@repo/drizzle";
import { LLMService } from "@repo/features/ai";

@Injectable()
export class StudioBrandVoiceService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly llm: LLMService,
  ) {}

  // ========================================
  // Brand Profile CRUD
  // ========================================

  /** 브랜드 프로필 조회 (없으면 null) */
  async getProfile(studioId: string, userId: string) {
    await this.assertStudioOwner(studioId, userId);

    const profile = await this.db
      .select()
      .from(studioBrandProfiles)
      .where(eq(studioBrandProfiles.studioId, studioId))
      .then((r) => r[0] ?? null);

    if (!profile) return null;

    // 활성 프리셋 정보도 함께 조회
    let activePreset = null;
    if (profile.activePresetId) {
      activePreset = await this.db
        .select()
        .from(studioTonePresets)
        .where(eq(studioTonePresets.id, profile.activePresetId))
        .then((r) => r[0] ?? null);
    }

    return { ...profile, activePreset };
  }

  /** 브랜드 프로필 생성/수정 (Upsert) */
  async upsertProfile(
    studioId: string,
    input: {
      brandName: string;
      industry?: string | null;
      targetAudience?: string | null;
      formality?: number;
      friendliness?: number;
      humor?: number;
      sentenceLength?: "short" | "medium" | "long";
      forbiddenWords?: string[];
      requiredWords?: string[];
      additionalGuidelines?: string | null;
    },
    userId: string,
  ) {
    await this.assertStudioOwner(studioId, userId);

    const existing = await this.db
      .select()
      .from(studioBrandProfiles)
      .where(eq(studioBrandProfiles.studioId, studioId))
      .then((r) => r[0]);

    if (existing) {
      const [updated] = await this.db
        .update(studioBrandProfiles)
        .set(input)
        .where(eq(studioBrandProfiles.studioId, studioId))
        .returning();
      return updated!;
    }

    const [created] = await this.db
      .insert(studioBrandProfiles)
      .values({ studioId, ...input })
      .returning();
    return created!;
  }

  /** 브랜드 프로필 삭제 */
  async deleteProfile(studioId: string, userId: string) {
    await this.assertStudioOwner(studioId, userId);

    await this.db
      .delete(studioBrandProfiles)
      .where(eq(studioBrandProfiles.studioId, studioId));

    return { success: true };
  }

  /** 활성 프리셋 설정 */
  async setActivePreset(
    studioId: string,
    presetId: string | null,
    userId: string,
  ) {
    await this.assertStudioOwner(studioId, userId);

    const profile = await this.db
      .select()
      .from(studioBrandProfiles)
      .where(eq(studioBrandProfiles.studioId, studioId))
      .then((r) => r[0]);

    if (!profile)
      throw new NotFoundException("브랜드 프로필을 먼저 생성하세요");

    if (presetId) {
      // 프리셋 존재 확인 (시스템 or 해당 스튜디오의 커스텀)
      const preset = await this.db
        .select()
        .from(studioTonePresets)
        .where(
          and(
            eq(studioTonePresets.id, presetId),
            or(
              eq(studioTonePresets.isSystem, true),
              eq(studioTonePresets.studioId, studioId),
            ),
          ),
        )
        .then((r) => r[0]);

      if (!preset) throw new NotFoundException("프리셋을 찾을 수 없습니다");
    }

    const [updated] = await this.db
      .update(studioBrandProfiles)
      .set({ activePresetId: presetId })
      .where(eq(studioBrandProfiles.studioId, studioId))
      .returning();

    return updated!;
  }

  // ========================================
  // Tone Presets CRUD
  // ========================================

  /** 프리셋 목록 (시스템 + 커스텀) */
  async listPresets(studioId: string, userId: string) {
    await this.assertStudioOwner(studioId, userId);

    return this.db
      .select()
      .from(studioTonePresets)
      .where(
        or(
          eq(studioTonePresets.isSystem, true),
          eq(studioTonePresets.studioId, studioId),
        ),
      )
      .orderBy(studioTonePresets.isSystem, studioTonePresets.createdAt);
  }

  /** 커스텀 프리셋 생성 */
  async createPreset(
    studioId: string,
    input: {
      name: string;
      description?: string;
      formality: number;
      friendliness: number;
      humor: number;
      sentenceLength: "short" | "medium" | "long";
      systemPromptSuffix?: string;
    },
    userId: string,
  ) {
    await this.assertStudioOwner(studioId, userId);

    // 동일 이름 중복 검사
    const existing = await this.db
      .select()
      .from(studioTonePresets)
      .where(
        and(
          eq(studioTonePresets.studioId, studioId),
          eq(studioTonePresets.name, input.name),
        ),
      )
      .then((r) => r[0]);

    if (existing)
      throw new ConflictException("이미 같은 이름의 프리셋이 있습니다");

    const [created] = await this.db
      .insert(studioTonePresets)
      .values({ studioId, isSystem: false, ...input })
      .returning();

    return created!;
  }

  /** 커스텀 프리셋 수정 */
  async updatePreset(
    presetId: string,
    input: {
      name?: string;
      description?: string | null;
      formality?: number;
      friendliness?: number;
      humor?: number;
      sentenceLength?: "short" | "medium" | "long";
      systemPromptSuffix?: string | null;
    },
    userId: string,
  ) {
    const preset = await this.db
      .select()
      .from(studioTonePresets)
      .where(eq(studioTonePresets.id, presetId))
      .then((r) => r[0]);

    if (!preset) throw new NotFoundException("프리셋을 찾을 수 없습니다");
    if (preset.isSystem)
      throw new ForbiddenException("시스템 프리셋은 수정할 수 없습니다");

    await this.assertStudioOwner(preset.studioId!, userId);

    const [updated] = await this.db
      .update(studioTonePresets)
      .set(input)
      .where(eq(studioTonePresets.id, presetId))
      .returning();

    return updated!;
  }

  /** 커스텀 프리셋 삭제 */
  async deletePreset(presetId: string, userId: string) {
    const preset = await this.db
      .select()
      .from(studioTonePresets)
      .where(eq(studioTonePresets.id, presetId))
      .then((r) => r[0]);

    if (!preset) throw new NotFoundException("프리셋을 찾을 수 없습니다");
    if (preset.isSystem)
      throw new ForbiddenException("시스템 프리셋은 삭제할 수 없습니다");

    await this.assertStudioOwner(preset.studioId!, userId);

    // 활성 프리셋으로 설정되어 있으면 null로 리셋
    await this.db
      .update(studioBrandProfiles)
      .set({ activePresetId: null })
      .where(eq(studioBrandProfiles.activePresetId, presetId));

    await this.db
      .delete(studioTonePresets)
      .where(eq(studioTonePresets.id, presetId));

    return { success: true };
  }

  // ========================================
  // AI - 금칙어 대체어 추천
  // ========================================

  /** 금칙어 대체어 추천 (AI) */
  async suggestAlternatives(
    studioId: string,
    word: string,
    context: string,
    userId: string,
  ): Promise<string[]> {
    await this.assertStudioOwner(studioId, userId);

    const raw = await this.llm.chatCompletion(
      [
        {
          role: "system",
          content: `당신은 한국어 카피라이팅 전문가입니다.
사용자가 제시한 금칙어에 대해 문맥에 맞는 대체어 3~5개를 추천합니다.
응답은 반드시 JSON 형식으로:
{ "alternatives": ["대체어1", "대체어2", "대체어3"] }`,
        },
        {
          role: "user",
          content: `금칙어: "${word}"
문맥: "${context}"
이 금칙어를 대체할 수 있는 자연스러운 단어/표현을 추천해주세요.`,
        },
      ],
      { jsonMode: true },
    );

    try {
      const parsed = JSON.parse(raw);
      return (parsed.alternatives ?? []) as string[];
    } catch {
      return [];
    }
  }

  // ========================================
  // Brand Context Builder (AI 주입용)
  // ========================================

  /** 스튜디오의 브랜드 컨텍스트 빌드 (AI 프롬프트 주입용) */
  async buildBrandContext(studioId: string): Promise<string | null> {
    const profile = await this.db
      .select()
      .from(studioBrandProfiles)
      .where(eq(studioBrandProfiles.studioId, studioId))
      .then((r) => r[0]);

    if (!profile) return null;

    // 활성 프리셋이 있으면 톤 설정 오버라이드
    let tone = {
      formality: profile.formality,
      friendliness: profile.friendliness,
      humor: profile.humor,
      sentenceLength: profile.sentenceLength,
    };

    if (profile.activePresetId) {
      const preset = await this.db
        .select()
        .from(studioTonePresets)
        .where(eq(studioTonePresets.id, profile.activePresetId))
        .then((r) => r[0]);

      if (preset) {
        tone = {
          formality: preset.formality,
          friendliness: preset.friendliness,
          humor: preset.humor,
          sentenceLength: preset.sentenceLength,
        };
      }
    }

    const formalityLabel = ["반말체", "구어체", "보통체", "존댓말", "격식체"][tone.formality - 1] ?? "보통체";
    const friendlinessLabel = ["매우 딱딱한", "딱딱한", "보통", "친근한", "매우 친근한"][tone.friendliness - 1] ?? "보통";
    const humorLabel = ["매우 진지한", "진지한", "보통", "가벼운", "유머러스한"][tone.humor - 1] ?? "보통";
    const lengthLabel = { short: "짧고 간결한", medium: "보통 길이의", long: "상세하고 긴" }[tone.sentenceLength] ?? "보통 길이의";

    let ctx = `\n\n[브랜드 보이스 가이드]
- 브랜드: ${profile.brandName}`;

    if (profile.industry) ctx += `\n- 산업군: ${profile.industry}`;
    if (profile.targetAudience) ctx += `\n- 타겟 고객: ${profile.targetAudience}`;

    ctx += `\n- 문체: ${formalityLabel}, ${friendlinessLabel} 어조, ${humorLabel} 톤`;
    ctx += `\n- 문장 길이: ${lengthLabel} 문장 선호`;

    if (profile.forbiddenWords && profile.forbiddenWords.length > 0) {
      ctx += `\n- 금칙어 (절대 사용 금지): ${profile.forbiddenWords.join(", ")}`;
    }

    if (profile.requiredWords && profile.requiredWords.length > 0) {
      ctx += `\n- 필수 키워드 (자연스럽게 포함): ${profile.requiredWords.join(", ")}`;
    }

    if (profile.additionalGuidelines) {
      ctx += `\n- 추가 가이드라인: ${profile.additionalGuidelines}`;
    }

    return ctx;
  }

  // ========================================
  // Helpers
  // ========================================

  private async assertStudioOwner(studioId: string, userId: string) {
    const studio = await this.db
      .select({ ownerId: studioStudios.ownerId })
      .from(studioStudios)
      .where(
        and(eq(studioStudios.id, studioId), eq(studioStudios.isDeleted, false)),
      )
      .then((r) => r[0]);

    if (!studio) throw new NotFoundException("스튜디오를 찾을 수 없습니다");
    if (studio.ownerId !== userId)
      throw new ForbiddenException("소유자만 수정할 수 있습니다");
  }
}
```

**Verification:**
```bash
cd packages/features && pnpm tsc --noEmit
```

---

## Task 3: AI 통합 — `LLMService`에 brandContext 주입

**Files:**
- Modify: `packages/features/ai/types/index.ts`
- Modify: `packages/features/ai/service/llm.service.ts`

**Changes in `types/index.ts`:**

`SuggestTopicsInput`에 필드 추가:

```typescript
export interface SuggestTopicsInput {
  contextTitle: string;
  contextDescription?: string;
  items: { title: string; itemType: string; contentPreview: string }[];
  nodeTypes?: string[];
  brandContext?: string; // 브랜드 보이스 컨텍스트 (시스템 프롬프트에 추가)
}
```

`GenerateDraftInput`에 필드 추가:

```typescript
export interface GenerateDraftInput {
  contextTitle: string;
  topicTitle: string;
  topicDescription: string;
  nodeType: string;
  existingTitles: string[];
  brandContext?: string; // 브랜드 보이스 컨텍스트
}
```

**Changes in `llm.service.ts`:**

`suggestTopics` 메서드 — 시스템 프롬프트 끝에 brandContext 추가:

```typescript
// 기존 시스템 프롬프트 마지막 줄 뒤에:
const systemPrompt = `당신은 그래프 기반 지식 콘텐츠 시스템의 주제 추천 전문가입니다.
...기존 내용 유지...
3~5개의 주제를 추천하세요. 다양한 nodeType을 활용하세요.${input.brandContext ?? ""}`;
```

`generateDraft` 메서드 — 시스템 프롬프트 끝에 brandContext 추가:

```typescript
// 기존 시스템 프롬프트 마지막 줄 뒤에:
const systemPrompt = `당신은 그래프 기반 블로그 콘텐츠 작성 전문가입니다.
...기존 내용 유지...
최소 3개 섹션 이상으로 구성하고, 각 섹션에 충분한 내용을 포함하세요.${input.brandContext ?? ""}`;
```

**핵심**: 기존 하드코딩된 시스템 프롬프트 문자열 끝에 `${input.brandContext ?? ""}`만 추가. brandContext가 없으면 빈 문자열이므로 기존 동작 변화 없음.

**Verification:**
```bash
cd packages/features && pnpm tsc --noEmit
```

---

## Task 4: AI 통합 — `StudioAiSuggestService`에서 브랜드 컨텍스트 로드

**Files:**
- Modify: `packages/features/content-studio/service/studio-ai-suggest.service.ts`
- Modify: `packages/features/content-studio/content-studio.module.ts`

**Changes in `studio-ai-suggest.service.ts`:**

1. import 추가:
```typescript
import { StudioBrandVoiceService } from "./studio-brand-voice.service";
```

2. 생성자에 DI 추가:
```typescript
constructor(
  @Inject(DRIZZLE) private readonly db: DrizzleDB,
  private readonly llm: LLMService,
  private readonly brandVoice: StudioBrandVoiceService,
) {}
```

3. `suggest` 메서드에서 brandContext 로드 + 전달:
```typescript
async suggest(
  input: { topicId: string; studioId: string; prompt?: string; presetId?: string },
  userId: string,
): Promise<TopicSuggestion[]> {
  // ... 기존 코드 유지 (assertStudioOwner, topic 조회, studio 조회, existingContents) ...

  // 브랜드 컨텍스트 로드
  const brandContext = await this.brandVoice.buildBrandContext(input.studioId);

  return this.llm.suggestTopics({
    contextTitle,
    contextDescription: studio.description ?? undefined,
    items,
    brandContext: brandContext ?? undefined,
  });
}
```

4. `generate` 메서드에서도 동일:
```typescript
async generate(
  input: { studioId: string; topicId: string; suggestion: TopicSuggestion },
  userId: string,
) {
  // ... 기존 코드 유지 ...

  // 브랜드 컨텍스트 로드
  const brandContext = await this.brandVoice.buildBrandContext(input.studioId);

  const draft = await this.llm.generateDraft({
    contextTitle: studio.title,
    topicTitle: input.suggestion.title,
    topicDescription: input.suggestion.description,
    nodeType: input.suggestion.nodeType,
    existingTitles,
    brandContext: brandContext ?? undefined,
  });

  // ... 나머지 기존 코드 유지 ...
}
```

**Changes in `content-studio.module.ts`:**

```typescript
import { StudioBrandVoiceService } from "./service/studio-brand-voice.service";
import {
  injectContentStudioService,
  injectStudioAiSuggestService,
  injectStudioBrandVoiceService,
} from "./trpc";

@Module({
  imports: [AIModule],
  providers: [ContentStudioService, StudioAiSuggestService, StudioBrandVoiceService],
  exports: [ContentStudioService, StudioAiSuggestService, StudioBrandVoiceService],
})
export class ContentStudioModule implements OnModuleInit {
  constructor(
    private readonly service: ContentStudioService,
    private readonly aiSuggestService: StudioAiSuggestService,
    private readonly brandVoiceService: StudioBrandVoiceService,
  ) {}

  onModuleInit() {
    injectContentStudioService(this.service);
    injectStudioAiSuggestService(this.aiSuggestService);
    injectStudioBrandVoiceService(this.brandVoiceService);
  }
}
```

**Verification:**
```bash
cd packages/features && pnpm tsc --noEmit
```

---

## Task 5: Router — `brandVoice` sub-router 추가

**Files:**
- Modify: `packages/features/content-studio/trpc/content-studio.route.ts`
- Modify: `packages/features/content-studio/trpc/index.ts`
- Modify: `packages/features/content-studio/index.ts`

**Changes in `content-studio.route.ts`:**

1. import 추가:
```typescript
import type { StudioBrandVoiceService } from "../service/studio-brand-voice.service";
```

2. Service Container 추가 (기존 `aiServices` 아래):
```typescript
const brandVoiceServices = createSingleServiceContainer<StudioBrandVoiceService>();
export const injectStudioBrandVoiceService = brandVoiceServices.inject;
```

3. Zod 스키마 추가 (기존 스키마 섹션 하단):
```typescript
// Brand Voice
const upsertBrandProfileSchema = z.object({
  studioId: z.string().uuid(),
  brandName: z.string().min(1).max(100),
  industry: z.string().max(100).optional().nullable(),
  targetAudience: z.string().max(500).optional().nullable(),
  formality: z.number().int().min(1).max(5).default(3),
  friendliness: z.number().int().min(1).max(5).default(3),
  humor: z.number().int().min(1).max(5).default(2),
  sentenceLength: z.enum(["short", "medium", "long"]).default("medium"),
  forbiddenWords: z.array(z.string().max(50)).max(50).default([]),
  requiredWords: z.array(z.string().max(50)).max(50).default([]),
  additionalGuidelines: z.string().max(2000).optional().nullable(),
});

const createPresetSchema = z.object({
  studioId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  formality: z.number().int().min(1).max(5),
  friendliness: z.number().int().min(1).max(5),
  humor: z.number().int().min(1).max(5),
  sentenceLength: z.enum(["short", "medium", "long"]),
  systemPromptSuffix: z.string().max(1000).optional(),
});

const updatePresetSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  formality: z.number().int().min(1).max(5).optional(),
  friendliness: z.number().int().min(1).max(5).optional(),
  humor: z.number().int().min(1).max(5).optional(),
  sentenceLength: z.enum(["short", "medium", "long"]).optional(),
  systemPromptSuffix: z.string().max(1000).optional().nullable(),
});

const suggestAlternativesSchema = z.object({
  studioId: z.string().uuid(),
  word: z.string().min(1).max(50),
  context: z.string().max(500),
});
```

4. Router에 `brandVoice` sub-router 추가 (기존 `ai` sub-router 뒤):
```typescript
// 기존 contentStudioRouter에 추가:
brandVoice: router({
  getProfile: authProcedure
    .input(z.object({ studioId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      return brandVoiceServices.service().getProfile(input.studioId, ctx.user!.id);
    }),

  upsertProfile: authProcedure
    .input(upsertBrandProfileSchema)
    .mutation(async ({ input, ctx }) => {
      const { studioId, ...data } = input;
      return brandVoiceServices.service().upsertProfile(studioId, data, ctx.user!.id);
    }),

  deleteProfile: authProcedure
    .input(z.object({ studioId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      return brandVoiceServices.service().deleteProfile(input.studioId, ctx.user!.id);
    }),

  setActivePreset: authProcedure
    .input(z.object({
      studioId: z.string().uuid(),
      presetId: z.string().uuid().nullable(),
    }))
    .mutation(async ({ input, ctx }) => {
      return brandVoiceServices.service().setActivePreset(
        input.studioId,
        input.presetId,
        ctx.user!.id,
      );
    }),

  presets: authProcedure
    .input(z.object({ studioId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      return brandVoiceServices.service().listPresets(input.studioId, ctx.user!.id);
    }),

  createPreset: authProcedure
    .input(createPresetSchema)
    .mutation(async ({ input, ctx }) => {
      const { studioId, ...data } = input;
      return brandVoiceServices.service().createPreset(studioId, data, ctx.user!.id);
    }),

  updatePreset: authProcedure
    .input(z.object({ id: z.string().uuid(), data: updatePresetSchema }))
    .mutation(async ({ input, ctx }) => {
      return brandVoiceServices.service().updatePreset(input.id, input.data, ctx.user!.id);
    }),

  deletePreset: authProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      return brandVoiceServices.service().deletePreset(input.id, ctx.user!.id);
    }),

  suggestAlternatives: authProcedure
    .input(suggestAlternativesSchema)
    .mutation(async ({ input, ctx }) => {
      return brandVoiceServices.service().suggestAlternatives(
        input.studioId,
        input.word,
        input.context,
        ctx.user!.id,
      );
    }),
}),
```

**Changes in `trpc/index.ts`:**

```typescript
export {
  contentStudioRouter,
  injectContentStudioService,
  injectStudioAiSuggestService,
  injectStudioBrandVoiceService,
} from "./content-studio.route";
export type { ContentStudioRouter } from "./content-studio.route";
```

**Changes in `index.ts`:**

`StudioBrandVoiceService` export 추가:

```typescript
export { StudioBrandVoiceService } from "./service/studio-brand-voice.service";
```

**Verification:**
```bash
cd packages/features && pnpm tsc --noEmit
cd apps/server && pnpm tsc --noEmit
```

---

## Task 6: Frontend — 브랜드 보이스 hooks

**Files:**
- Create: `apps/app/src/features/content-studio/hooks/use-brand-voice.ts`
- Modify: `apps/app/src/features/content-studio/hooks/index.ts` — re-export 추가

**참고 패턴:** `apps/app/src/features/content-studio/hooks/use-ai-suggest.ts`

**Changes in `use-brand-voice.ts`:**

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";

export function useBrandProfile(studioId: string) {
  const trpc = useTRPC();

  const query = useQuery(
    trpc.contentStudio.brandVoice.getProfile.queryOptions({ studioId }),
  );

  return query;
}

export function useUpsertBrandProfile(studioId: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const profileKey = trpc.contentStudio.brandVoice.getProfile.queryKey({ studioId });

  const upsert = useMutation(
    trpc.contentStudio.brandVoice.upsertProfile.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: profileKey }),
    }),
  );

  return { upsert };
}

export function useDeleteBrandProfile(studioId: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const profileKey = trpc.contentStudio.brandVoice.getProfile.queryKey({ studioId });

  const deleteProfile = useMutation(
    trpc.contentStudio.brandVoice.deleteProfile.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: profileKey }),
    }),
  );

  return { deleteProfile };
}

export function useSetActivePreset(studioId: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const profileKey = trpc.contentStudio.brandVoice.getProfile.queryKey({ studioId });

  const setPreset = useMutation(
    trpc.contentStudio.brandVoice.setActivePreset.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: profileKey }),
    }),
  );

  return { setPreset };
}

export function useTonePresets(studioId: string) {
  const trpc = useTRPC();

  return useQuery(
    trpc.contentStudio.brandVoice.presets.queryOptions({ studioId }),
  );
}

export function usePresetMutations(studioId: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const presetsKey = trpc.contentStudio.brandVoice.presets.queryKey({ studioId });
  const profileKey = trpc.contentStudio.brandVoice.getProfile.queryKey({ studioId });

  const createPreset = useMutation(
    trpc.contentStudio.brandVoice.createPreset.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: presetsKey }),
    }),
  );

  const updatePreset = useMutation(
    trpc.contentStudio.brandVoice.updatePreset.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: presetsKey }),
    }),
  );

  const deletePreset = useMutation(
    trpc.contentStudio.brandVoice.deletePreset.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: presetsKey });
        queryClient.invalidateQueries({ queryKey: profileKey });
      },
    }),
  );

  return { createPreset, updatePreset, deletePreset };
}

export function useSuggestAlternatives() {
  const trpc = useTRPC();

  const suggest = useMutation(
    trpc.contentStudio.brandVoice.suggestAlternatives.mutationOptions(),
  );

  return { suggest };
}
```

**Changes in `hooks/index.ts`:**

기존 export 목록에 추가:

```typescript
export {
  useBrandProfile,
  useUpsertBrandProfile,
  useDeleteBrandProfile,
  useSetActivePreset,
  useTonePresets,
  usePresetMutations,
  useSuggestAlternatives,
} from "./use-brand-voice";
```

**Verification:**
```bash
cd apps/app && pnpm tsc --noEmit
```

---

## Task 7: Frontend — 브랜드 보이스 설정 페이지

**Files:**
- Create: `apps/app/src/features/content-studio/pages/brand-voice-page.tsx`
- Modify: `apps/app/src/features/content-studio/routes/index.tsx` — 라우트 추가

**`brand-voice-page.tsx` 핵심 구조:**

- `<Feature>` + `<FeatureHeader>` + `<FeatureContents>` 레이아웃
- 탭 2개: "브랜드 프로필" / "톤 프리셋"
- 브랜드 프로필 탭:
  - 브랜드명, 산업군, 타겟 고객 입력 필드
  - 톤 슬라이더 3개 (formality, friendliness, humor) — `@repo/ui/shadcn/slider` 사용
  - 문장 길이 선택 — `@repo/ui/shadcn/select` 사용
  - 금칙어/필수 키워드 — 태그 입력 (Input + 엔터로 추가, Badge로 표시, X로 삭제)
  - 추가 가이드라인 — Textarea
  - 저장 버튼 → `useUpsertBrandProfile()`
- 톤 프리셋 탭:
  - 프리셋 목록 (시스템 프리셋은 배지 표시, 수정/삭제 불가)
  - "활성화" 버튼 → `useSetActivePreset()`
  - "프리셋 추가" 버튼 → Dialog로 생성 폼
  - 커스텀 프리셋 수정/삭제

**데이터 5가지 상태 적용:**
- Loading: Skeleton
- Empty: "브랜드 프로필을 설정하면 AI가 일관된 톤으로 콘텐츠를 생성합니다" + "시작하기" CTA
- Error: 에러 메시지 + 재시도 버튼
- Default: 프로필 폼

**라우트 추가 (`routes/index.tsx`):**

```typescript
// 기존 createContentStudioRoutes에 브랜드 보이스 라우트 추가
export const createBrandVoiceRoute = <T extends AnyRoute>(parentRoute: T) =>
  createRoute({
    getParentRoute: () => parentRoute,
    path: "/content-studio/$studioId/brand-voice",
    component: BrandVoicePage,
  });
```

`createContentStudioRoutes`의 반환 배열에 추가.

**Verification:**
```bash
cd apps/app && pnpm tsc --noEmit
```

---

## Task 8: Frontend — 에디터에 금칙어 검사 배너 추가

**Files:**
- Modify: `apps/app/src/features/content-studio/pages/editor-page.tsx`

**Changes:**

에디터 페이지에 금칙어 검사 기능 추가:

1. `useBrandProfile(studioId)` hook으로 금칙어 목록 로드
2. 본문 텍스트에서 금칙어 매칭 (정규식)
3. 금칙어 발견 시 에디터 상단에 경고 배너:
   - "금칙어 감지: [단어1], [단어2]"
   - 각 단어 클릭 시 `useSuggestAlternatives()`로 대체어 추천 Popover 표시

**구현 방식:**

```typescript
// 금칙어 검사 유틸
function findForbiddenWords(text: string, forbiddenWords: string[]): string[] {
  if (!forbiddenWords.length) return [];
  const found: string[] = [];
  for (const word of forbiddenWords) {
    const regex = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    if (regex.test(text)) found.push(word);
  }
  return [...new Set(found)];
}
```

에디터 헤더 바와 본문 사이에 경고 배너 조건부 렌더링:

```tsx
{detectedWords.length > 0 && (
  <ForbiddenWordsBanner
    words={detectedWords}
    studioId={studioId}
  />
)}
```

`ForbiddenWordsBanner` 컴포넌트:
- 노란색 경고 배너 (`bg-yellow-50 border-yellow-200`)
- 금칙어 목록을 Badge로 표시
- Badge 클릭 → `suggestAlternatives` mutation → Popover로 대체어 표시

**Verification:**
```bash
cd apps/app && pnpm tsc --noEmit
```

---

## Task 9: Frontend — 캔버스에서 브랜드 보이스 설정 진입점

**Files:**
- Modify: `apps/app/src/features/content-studio/components/canvas/canvas-toolbar.tsx`

**Changes:**

캔버스 툴바에 "브랜드 보이스" 버튼 추가:
- `Palette` 아이콘 (from lucide-react) + "브랜드 보이스" 라벨
- 클릭 → `navigate({ to: "/content-studio/$studioId/brand-voice", params: { studioId } })`
- 브랜드 프로필 설정 유무에 따라 활성 상태 표시 (dot indicator)

**Verification:**
```bash
cd apps/app && pnpm tsc --noEmit
```

---

## Task 10: 시스템 프리셋 Seed + 빌드 검증 + 레퍼런스 업데이트

**Files:**
- Create: `packages/drizzle/src/seed/tone-presets.ts` (시스템 프리셋 seed 데이터)
- Modify: `docs/reference/features-backend.md` — content-studio 섹션에 brandVoice 프로시저 추가
- Modify: `docs/reference/features-frontend.md` — content-studio 섹션에 brand-voice hooks/pages 추가
- Modify: `docs/reference/database-schema.md` — studio_brand_profiles, studio_tone_presets 테이블 추가

**시스템 프리셋 seed:**

```typescript
export const SYSTEM_TONE_PRESETS = [
  {
    name: "전문 블로그",
    description: "전문적이고 깊이 있는 블로그 콘텐츠에 적합",
    formality: 4,
    friendliness: 3,
    humor: 1,
    sentenceLength: "long" as const,
    isSystem: true,
    systemPromptSuffix: "전문적이고 권위 있는 어조로 작성하세요. 데이터와 근거를 포함하세요.",
  },
  {
    name: "캐주얼 SNS",
    description: "Instagram, Twitter 등 SNS 콘텐츠에 적합",
    formality: 1,
    friendliness: 5,
    humor: 4,
    sentenceLength: "short" as const,
    isSystem: true,
    systemPromptSuffix: "짧고 임팩트 있는 문장으로 작성하세요. 이모지를 적절히 활용하세요.",
  },
  {
    name: "포멀 보도자료",
    description: "공식 보도자료, 기업 발표에 적합",
    formality: 5,
    friendliness: 1,
    humor: 1,
    sentenceLength: "medium" as const,
    isSystem: true,
    systemPromptSuffix: "격식체를 사용하고 객관적 사실 중심으로 작성하세요.",
  },
  {
    name: "친근한 뉴스레터",
    description: "구독자에게 보내는 친근한 뉴스레터에 적합",
    formality: 2,
    friendliness: 5,
    humor: 3,
    sentenceLength: "medium" as const,
    isSystem: true,
    systemPromptSuffix: "구독자에게 말하듯 친근하게 작성하세요. 개인적인 톤을 유지하세요.",
  },
  {
    name: "기술 문서",
    description: "개발 문서, 기술 가이드에 적합",
    formality: 4,
    friendliness: 2,
    humor: 1,
    sentenceLength: "long" as const,
    isSystem: true,
    systemPromptSuffix: "정확하고 간결한 기술 문서 스타일로 작성하세요. 코드 예시를 포함하세요.",
  },
];
```

**최종 빌드 검증:**
```bash
cd packages/drizzle && pnpm tsc --noEmit
cd packages/features && pnpm tsc --noEmit
cd apps/server && pnpm tsc --noEmit
cd apps/app && pnpm tsc --noEmit
```

---

## 파일 변경 요약

| 파일 | 작업 |
|------|------|
| `packages/drizzle/src/schema/features/content-studio/index.ts` | `studioBrandProfiles`, `studioTonePresets` 테이블 + relations + types 추가 |
| `packages/features/content-studio/service/studio-brand-voice.service.ts` | **신규** 브랜드 보이스 서비스 |
| `packages/features/ai/types/index.ts` | `brandContext` 필드 추가 |
| `packages/features/ai/service/llm.service.ts` | 시스템 프롬프트에 brandContext 주입 |
| `packages/features/content-studio/service/studio-ai-suggest.service.ts` | brandContext 로드 + LLM에 전달 |
| `packages/features/content-studio/content-studio.module.ts` | `StudioBrandVoiceService` 등록 |
| `packages/features/content-studio/trpc/content-studio.route.ts` | `brandVoice` sub-router 추가 |
| `packages/features/content-studio/trpc/index.ts` | export 추가 |
| `packages/features/content-studio/index.ts` | export 추가 |
| `apps/app/src/features/content-studio/hooks/use-brand-voice.ts` | **신규** 브랜드 보이스 hooks |
| `apps/app/src/features/content-studio/hooks/index.ts` | re-export 추가 |
| `apps/app/src/features/content-studio/pages/brand-voice-page.tsx` | **신규** 브랜드 보이스 설정 페이지 |
| `apps/app/src/features/content-studio/routes/index.tsx` | 라우트 추가 |
| `apps/app/src/features/content-studio/pages/editor-page.tsx` | 금칙어 검사 배너 추가 |
| `apps/app/src/features/content-studio/components/canvas/canvas-toolbar.tsx` | 브랜드 보이스 진입점 추가 |
| `packages/drizzle/src/seed/tone-presets.ts` | **신규** 시스템 프리셋 seed |
| `docs/reference/features-backend.md` | 업데이트 |
| `docs/reference/features-frontend.md` | 업데이트 |
| `docs/reference/database-schema.md` | 업데이트 |
