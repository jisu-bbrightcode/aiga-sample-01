# Studio AI Suggest Design

## Goal

Content Studio에서 주제(Topic)를 기반으로 AI가 콘텐츠를 추천하고 초안을 자동 생성하는 기능. 즉시 호출과 주기적 반복 모두 지원.

## 핵심 원칙

- **독립 서비스**: Cron/Recurrence에 의존하지 않는 독립적인 AI 추천 엔진
- **즉시 + 예약**: 언제든 호출 가능하고, 원하면 주기적 자동 실행도 설정 가능
- **LLM 지식 기반**: 외부 검색 API 없이 GPT의 내재 지식으로 분석/추천
- **1개씩 생성**: 실행마다 주제 1개 선정 → 초안 1개를 draft 상태로 저장

## Architecture

### 레이어 분리

```
┌─────────────────────────────────────┐
│  Studio AI Suggest Service (핵심)   │  ← 언제든 호출 가능
│  - suggest()    주제 추천           │
│  - generate()   초안 생성           │
│  - suggestAndGenerate() 한방        │
└──────────────┬──────────────────────┘
               │
    ┌──────────┴──────────┐
    │                     │
  수동 호출            자동 실행 (선택)
  tRPC / UI 버튼       studio_ai_recurrences 규칙
                       + CronRunner 연동
```

### 기존 인프라 활용

| 기존 기능 | 활용 방식 |
|-----------|-----------|
| `LLMService.suggestTopics()` | 주제 추천 로직 재사용 |
| `LLMService.generateDraft()` | TipTap JSON 초안 생성 재사용 |
| `ContentStudioService` | 콘텐츠 CRUD (생성된 draft 저장) |
| `CronRunnerService.runJob()` | 주기적 실행 프레임워크 |

## Schema

### 새 테이블: `studio_ai_recurrences`

주기적 AI 추천 실행 규칙. 즉시 실행에는 이 테이블을 사용하지 않음.

```typescript
export const studioAiRecurrences = pgTable("studio_ai_recurrences", {
  ...baseColumns(),

  studioId: uuid("studio_id")
    .notNull()
    .references(() => studioStudios.id, { onDelete: "cascade" }),

  topicId: uuid("topic_id")
    .notNull()
    .references(() => studioTopics.id, { onDelete: "cascade" }),

  // 커스텀 프롬프트 (선택) — "SEO 중심으로", "초보자 대상" 등
  prompt: text("prompt"),

  // 반복 규칙
  rule: varchar("rule", { length: 50 }).notNull(), // weekly, biweekly, monthly

  isActive: boolean("is_active").notNull().default(true),
  nextRunAt: timestamp("next_run_at", { withTimezone: true }),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  totalGenerated: integer("total_generated").notNull().default(0),

  createdBy: uuid("created_by")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
});
```

### 생성된 콘텐츠 저장

별도 테이블 없이 기존 `studioContents`에 저장:

```
studioContents {
  status: "draft",
  label: "ai-suggested",      // AI 생성 콘텐츠 구분
  topicId: (연결된 주제),
  content: (TipTap JSON 초안),
  summary: (요약),
}
```

## tRPC API

```typescript
contentStudio.ai.suggest              // 즉시 추천 (topicId → TopicSuggestion[])
contentStudio.ai.generate             // 즉시 초안 생성 (suggestion → draft content)
contentStudio.ai.suggestAndGenerate   // 추천 + 초안 한번에 (topicId → draft content)

contentStudio.ai.recurrence.create    // 주기적 실행 규칙 생성
contentStudio.ai.recurrence.update    // 규칙 수정
contentStudio.ai.recurrence.delete    // 규칙 삭제
contentStudio.ai.recurrence.toggle    // 활성/비활성 토글
contentStudio.ai.recurrence.list      // 규칙 목록 조회
```

## Data Flow

### 즉시 실행

```
사용자: "이 주제에 대해 추천해줘" (UI 버튼 또는 API 호출)
    ↓
ai.suggestAndGenerate({ topicId, prompt? })
    ↓
1. 스튜디오 내 기존 콘텐츠 목록 조회
2. LLMService.suggestTopics() → 3-5개 추천 중 1개 선정
3. LLMService.generateDraft() → TipTap JSON 초안
4. studioContents INSERT (status: "draft", label: "ai-suggested")
    ↓
사용자에게 생성된 draft 반환
```

### 주기적 실행

```
사용자: ai.recurrence.create({ topicId, rule: "weekly", prompt? })
    ↓
CronRunner (매시간 체크)
    → nextRunAt이 지난 active recurrence 조회
    → suggestAndGenerate() 호출
    → nextRunAt 갱신, totalGenerated++
```

## 향후 고도화 방향

- 웹 검색 연동 (Tavily/Perplexity API)
- SEO 키워드 기반 추천
- 생성 품질 피드백 (좋아요/싫어요 → 프롬프트 자동 개선)
- 멀티 LLM 지원 (GPT, Claude, Gemini 선택)
- 추천 이력 관리 및 중복 방지
