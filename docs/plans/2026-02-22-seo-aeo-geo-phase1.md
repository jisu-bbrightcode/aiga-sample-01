# SEO·AEO·GEO 고도화 Phase 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 기존 SEO-only 분석 엔진을 SEO/AEO/GEO 통합 스코어링 엔진으로 마이그레이션하고, SEO 규칙을 24개로 확장하며, 분석 이력 DB 테이블을 추가한다.

**Architecture:** 기존 `seo-rules.ts` (16규칙, 100점)를 `analysis-rules.ts`로 리팩터링하여 3도메인(SEO/AEO/GEO) 통합 엔진을 구축한다. Phase 1에서는 SEO 24개 클라이언트 규칙만 구현하고, AEO/GEO는 빈 슬롯(0규칙)으로 남겨 Phase 2에서 추가한다. 기존 `useSeoScore` 훅을 `useAnalysisScore`로 교체하고, UI는 기존 MetaPanel의 탭명만 변경한다.

**Tech Stack:** TypeScript, React (useMemo), Drizzle ORM, tRPC, NestJS

**Scope:**

- Epic 1: 통합 스코어링 엔진 코어
- Epic 2: SEO 규칙 16→24 확장
- Epic 11: studioContentAnalysis DB 테이블

---

## Task 1: 통합 분석 엔진 타입 및 코어 (`analysis-rules.ts`)

**Files:**

- Create: `apps/app/src/features/content-studio/lib/analysis-rules.ts`
- Keep (deprecated): `apps/app/src/features/content-studio/lib/seo-rules.ts`

**What:**
새로운 `AnalysisRule`, `AnalysisContext`, `AnalysisResult` 인터페이스를 정의하고, 도메인별 가중치(SEO 40%, AEO 30%, GEO 30%) 합산 로직을 구현한다.

**Step 1:** `analysis-rules.ts` 파일 생성 — 타입 정의 + `buildAnalysisContext()` + 점수 계산 엔진

```typescript
// 핵심 타입
type AnalysisDomain = "seo" | "aeo" | "geo";
type RuleExecutionType = "client" | "server";

interface AnalysisRule {
  id: string;
  domain: AnalysisDomain;
  category: string;
  label: string;
  description: string;
  maxScore: number;
  executionType: RuleExecutionType;
  check: (ctx: AnalysisContext) => AnalysisResult;
}

interface AnalysisContext {
  // 기본 콘텐츠 필드 (기존 SeoContext 확장)
  title: string;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string[];
  bodyText: string;
  bodyHtml: string;
  slug: string | null;
  imageCount: number;
  imageAltCount: number;
  internalLinkCount: number;
  externalLinkCount: number;
  h2Count: number;
  h3Count: number;
  wordCount: number;
  paragraphs: string[];
  firstParagraph: string;
  // AEO 확장 (Phase 2에서 활용)
  faqSections: { question: string; answer: string }[];
  questionHeadings: string[];
  listCount: number;
  tableCount: number;
  // GEO 확장 (Phase 2에서 활용)
  citationCount: number;
  quotationCount: number;
  statisticCount: number;
  uniqueWordRatio: number;
  authorName: string | null;
  datePublished: string | null;
  dateModified: string | null;
}

interface AnalysisResult {
  status: "pass" | "partial" | "fail";
  score: number;
  message: string;
  suggestions?: string[];
  autoFixable?: boolean;
}

// 도메인 가중치
const DOMAIN_WEIGHTS: Record<AnalysisDomain, number> = { seo: 0.4, aeo: 0.3, geo: 0.3 };

// 점수 계산 엔진
function calculateScores(rules: AnalysisRule[], ctx: AnalysisContext) → DomainScores
```

**Step 2:** `buildAnalysisContext()` 구현 — 기존 `buildSeoContext()` 확장, AEO/GEO 필드는 기본값(0, [], null)

**Step 3:** 점수 계산 함수 구현:

- 도메인별 점수율: `(도메인 획득점 / 도메인 만점) × 100`
- 통합 점수: `SEO점수율×0.4 + AEO점수율×0.3 + GEO점수율×0.3`
- AEO/GEO 규칙이 0개일 때: 해당 도메인 점수율을 계산에서 제외하고 SEO 100%로 처리

**AC:** 타입 정의 완료, `buildAnalysisContext()` 동작, `calculateScores()` 가중치 합산 정확

---

## Task 2: 기존 SEO 16규칙 마이그레이션

**Files:**

- Modify: `apps/app/src/features/content-studio/lib/analysis-rules.ts` (Task 1에서 생성)
- Reference: `apps/app/src/features/content-studio/lib/seo-rules.ts` (기존)

**What:**
기존 `seo-rules.ts`의 16개 규칙 함수를 `analysis-rules.ts`로 마이그레이션한다. `SeoRule` → `AnalysisRule` 포맷 변환. 규칙 로직은 그대로 유지.

**Step 1:** 기존 16개 SEO 규칙을 `AnalysisRule` 배열로 변환

- `category` 필드를 FRD 기준으로 재매핑:
  - content: title-length, body-length, has-images, image-alt, readability
  - meta: meta-description, has-slug
  - structure: has-headings, keyword-title, keyword-subheading, keyword-first-para, keyword-density, keyword-meta, keyword-slug
  - link: internal-links, external-links
- `domain: "seo"` 추가
- `executionType: "client"` 추가
- check 함수는 `AnalysisContext` 인자를 받도록 시그니처만 변경 (로직 동일)

**Step 2:** `SEO_RULES` 배열을 `ANALYSIS_RULES`로 export

**AC:** 기존 16규칙이 새 포맷으로 동일 결과 반환

---

## Task 3: 신규 SEO 규칙 8개 추가

**Files:**

- Modify: `apps/app/src/features/content-studio/lib/analysis-rules.ts`

**What:**
FRD에 정의된 24개 SEO 규칙 중 기존에 없는 8개를 추가 구현한다.

**새 규칙 목록 (FRD 참조):**

| #   | ID                      | Label            | Points | 설명                                   |
| --- | ----------------------- | ---------------- | ------ | -------------------------------------- |
| 1   | seo-title-set           | SEO 전용 제목    | 5      | seoTitle이 title과 다르게 설정됐는지   |
| 2   | keyword-density-balance | 키워드 균형      | 5      | 키워드 과다(>5%)/과소(<0.5%) 감지      |
| 3   | paragraph-length        | 단락 길이        | 5      | 단락당 300자 이내                      |
| 4   | content-freshness       | 콘텐츠 신선도    | 5      | dateModified가 90일 이내               |
| 5   | og-image                | OG 이미지        | 5      | thumbnailUrl이 설정됐는지              |
| 6   | heading-hierarchy       | 헤딩 계층        | 5      | H2→H3 순서 준수                        |
| 7   | link-text-descriptive   | 링크 텍스트 품질 | 5      | "여기", "링크" 등 비서술적 텍스트 감지 |
| 8   | eeat-author             | 저자 정보        | 10     | authorName이 설정됐는지                |

**Step 1:** 8개 check 함수 구현 (각 15-30줄)
**Step 2:** `ANALYSIS_RULES` 배열에 추가 → 총 24개 SEO 규칙

**AC:** SEO 도메인 24개 규칙 등록, 각 규칙이 올바른 점수 반환

---

## Task 4: `useAnalysisScore` 훅 생성

**Files:**

- Create: `apps/app/src/features/content-studio/hooks/use-analysis-score.ts`
- Modify: `apps/app/src/features/content-studio/hooks/index.ts` (export 추가)

**What:**
기존 `useSeoScore` 훅을 대체하는 `useAnalysisScore` 훅을 만든다. 도메인별 점수 + 통합 점수를 반환.

```typescript
interface AnalysisScoreResult {
  totalScore: number; // 통합 가중치 점수 (0-100)
  domainScores: {
    seo: { score: number; maxScore: number; percentage: number };
    aeo: { score: number; maxScore: number; percentage: number };
    geo: { score: number; maxScore: number; percentage: number };
  };
  results: Array<{ rule: AnalysisRule; result: AnalysisResult }>;
  byDomain: Record<AnalysisDomain, Array<{ rule: AnalysisRule; result: AnalysisResult }>>;
  byCategory: Record<string, Array<{ rule: AnalysisRule; result: AnalysisResult }>>;
}
```

**Step 1:** 훅 구현 — `buildAnalysisContext()` + `calculateScores()` 조합, `useMemo`로 메모이제이션
**Step 2:** `hooks/index.ts`에 export 추가
**Step 3:** AnalysisContext에 필요한 새 입력 파라미터 정의 (thumbnailUrl, authorName 등)

**AC:** 훅이 도메인별+통합 점수를 정확히 반환. AEO/GEO 규칙 0개일 때 SEO 점수가 totalScore와 동일.

---

## Task 5: DB 스키마 — `studioContentAnalysis` 테이블

**Files:**

- Modify: `packages/drizzle/src/schema/features/content-studio/index.ts`

**What:**
분석 결과 이력을 저장하는 `studioContentAnalysis` 테이블을 추가한다 (FRD Architecture §2.1 참조).

```typescript
export const studioContentAnalysis = pgTable(
  "studio_content_analysis",
  {
    ...baseColumns(),
    contentId: uuid("content_id")
      .notNull()
      .references(() => studioContents.id, { onDelete: "cascade" }),
    seoScore: integer("seo_score").notNull().default(0),
    aeoScore: integer("aeo_score").notNull().default(0),
    geoScore: integer("geo_score").notNull().default(0),
    totalScore: integer("total_score").notNull().default(0),
    seoDetails: jsonb("seo_details").notNull().$type<Record<string, unknown>>(),
    aeoDetails: jsonb("aeo_details").notNull().$type<Record<string, unknown>>(),
    geoDetails: jsonb("geo_details").notNull().$type<Record<string, unknown>>(),
    analysisVersion: varchar("analysis_version", { length: 10 }).default("1.0"),
    snapshotAt: timestamp("snapshot_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_studio_content_analysis_content").on(table.contentId),
    index("idx_studio_content_analysis_snapshot").on(table.snapshotAt),
  ],
);
```

**Step 1:** 테이블 정의 추가 + relations 정의
**Step 2:** `pnpm db:push` 실행하여 스키마 반영

**AC:** 테이블 생성 성공, `db:push` 에러 없음

---

## Task 6: 백엔드 — 분석 저장/조회 tRPC 라우트

**Files:**

- Modify: `packages/features/content-studio/service/content-studio.service.ts` (메서드 추가)
- Modify: `packages/features/content-studio/trpc/content-studio.route.ts` (프로시저 추가)

**What:**
분석 결과 저장(mutation) + 이력 조회(query) 프로시저를 추가한다.

**Step 1:** `ContentStudioService`에 분석 저장/조회 메서드 추가:

- `saveAnalysisSnapshot(contentId, scores, details)` → INSERT into studioContentAnalysis
- `getAnalysisHistory(contentId)` → SELECT from studioContentAnalysis ORDER BY snapshotAt DESC LIMIT 20

**Step 2:** tRPC 라우트 추가:

- `contentStudio.analysis.save` (mutation)
- `contentStudio.analysis.history` (query)

**AC:** 분석 결과 저장 및 이력 조회 API 동작

---

## Task 7: 프론트엔드 — MetaPanel 통합 연결

**Files:**

- Modify: `apps/app/src/features/content-studio/components/editor/meta-panel.tsx` (탭명 변경)
- Modify: `apps/app/src/features/content-studio/components/editor/seo-panel.tsx` (useAnalysisScore 연결)
- Modify: `apps/app/src/features/content-studio/components/editor/seo-score-gauge.tsx` (통합 점수 표시)
- Modify: `apps/app/src/features/content-studio/components/editor/seo-checklist.tsx` (24규칙 표시)
- Modify: `apps/app/src/features/content-studio/pages/editor-page.tsx` (새 훅 연결)

**What:**
기존 UI를 새 통합 점수 시스템으로 연결한다. Phase 1에서는 대규모 UI 개편 없이 기존 레이아웃을 유지하면서 데이터만 교체한다.

**Step 1:** MetaPanel 탭명 변경: `SEO` → `분석`
**Step 2:** EditorPage에서 `useSeoScore` → `useAnalysisScore` 교체
**Step 3:** SeoPanel에서 통합 점수 표시 (기존 게이지 재활용, 서브 점수 추가)
**Step 4:** SeoChecklist에서 24개 규칙 표시 (기존 카테고리 구조 유지)

**AC:** 에디터 진입 시 24개 SEO 규칙 기반 통합 점수가 정상 표시됨. 기존 기능(키워드, 내부링크) 유지.

---

## Task 8: 빌드 검증 및 정리

**Files:**

- Modify: `packages/features/content-studio/index.ts` (export 추가)

**What:**
전체 빌드 검증, 기존 seo-rules.ts에 @deprecated 주석, export 정리.

**Step 1:** `seo-rules.ts` 상단에 `@deprecated` JSDoc 주석 추가
**Step 2:** `index.ts`에 새 서비스 export 추가 (필요 시)
**Step 3:** `pnpm build` 실행 — 에러 0 확인
**Step 4:** `pnpm db:push` 실행 — 스키마 동기화 확인

**AC:** `pnpm build` 성공, `pnpm db:push` 성공, 기존 기능 동작 유지

---

## 의존성 순서

```
Task 1 (엔진 코어) → Task 2 (SEO 마이그레이션) → Task 3 (신규 규칙)
                                                        ↓
Task 5 (DB 스키마) → Task 6 (백엔드 API)         Task 4 (훅)
                                                        ↓
                                                  Task 7 (UI 연결)
                                                        ↓
                                                  Task 8 (검증)
```

Task 1→2→3→4→7은 순차, Task 5→6은 병렬 가능.
