# SEO/AEO/GEO 통합 분석 엔진 — Phase 2 구현 계획

> Phase 1에서 구축한 통합 엔진(24 SEO 규칙)에 AEO 12규칙 + GEO 12규칙을 추가하여 총 48규칙 완성.

## 배경

- Phase 1: 통합 엔진 코어 + SEO 24규칙 + DB/API/UI 완료 (커밋 `39e15c7`)
- Phase 2: AEO 12규칙 + GEO 12규칙 추가, 텍스트 자동감지 강화, 도메인별 UI
- 에디터는 plain text `Textarea` — HTML 없음. 규칙은 **텍스트 패턴 분석** 기반.
- `AnalysisContext`에 AEO/GEO 필드가 이미 정의됨 (Phase 1에서 준비)
- `calculateScores()`가 활성 도메인만 가중치에 포함하므로 규칙 추가만으로 자동 활성화

## 가중치 공식 (변경 없음)

```
종합 = (SEO% × 0.4) + (AEO% × 0.3) + (GEO% × 0.3)
```

Phase 1: SEO만 활성 → SEO 100%. Phase 2: 3도메인 모두 활성 → 정상 가중치 적용.

---

## Task 1: 텍스트 분석 자동감지 헬퍼 + buildAnalysisContext 강화

**File:** `apps/app/src/features/content-studio/lib/analysis-rules.ts`

**What:**
`buildAnalysisContext`에서 plain text를 분석하여 AEO/GEO 필드를 자동 채우는 헬퍼 함수 추가.
명시적 값이 전달되면 그것을 우선 사용하고, 없으면 자동감지 결과 사용.

**헬퍼 함수 목록:**

```typescript
// AEO 자동감지
function detectQuestionHeadings(text: string): string[];
// "?"로 끝나는 줄을 질문형 제목으로 감지

function detectFaqSections(text: string): { question: string; answer: string }[];
// "Q:", "질문:", "?" 패턴 + 뒤따르는 텍스트를 FAQ로 감지

function countLists(text: string): number;
// "- ", "* ", "1. ", "2. " 등 리스트 항목 라인 수

function countTables(text: string): number;
// "|" 구분자가 포함된 마크다운 테이블 행 수

// GEO 자동감지
function countCitations(text: string): number;
// "[출처]", "~에 따르면", "(출처:", URL 패턴

function countQuotations(text: string): number;
// 따옴표("")로 감싼 인용문 수

function countStatistics(text: string): number;
// 숫자+%/원/달러/명/건/배 등 통계 패턴

function calculateUniqueWordRatio(text: string): number;
// 고유 어절 수 / 전체 어절 수
```

**buildAnalysisContext 변경:**

```typescript
// Before (Phase 1):
listCount: params.listCount ?? 0,

// After (Phase 2):
listCount: params.listCount ?? countLists(bodyText),
```

**AC:** 모든 AEO/GEO 컨텍스트 필드가 plain text에서 자동감지됨.

---

## Task 2: AEO 12규칙 (100점)

**File:** `apps/app/src/features/content-studio/lib/analysis-rules.ts`

AEO (Answer Engine Optimization): AI 검색엔진/답변 엔진에서 발견되기 위한 최적화.

### 규칙 목록

| #   | ID                     | Category  | Label             | MaxScore | 체크 로직                                         |
| --- | ---------------------- | --------- | ----------------- | -------- | ------------------------------------------------- |
| 1   | aeo-faq-presence       | answer    | FAQ 섹션          | 10       | faqSections.length >= 1 → pass, 0 → fail          |
| 2   | aeo-faq-quality        | answer    | FAQ 답변 품질     | 8        | FAQ 답변 평균 50-200자 → pass, 30-300자 → partial |
| 3   | aeo-question-headings  | answer    | 질문형 제목       | 10       | questionHeadings.length >= 2 → pass, 1 → partial  |
| 4   | aeo-direct-answer      | answer    | 직접 답변         | 10       | 첫 100자에 핵심 문장(마침표 포함) → pass          |
| 5   | aeo-structured-lists   | structure | 구조화 목록       | 8        | listCount >= 3 → pass, 1-2 → partial              |
| 6   | aeo-data-table         | structure | 데이터 테이블     | 7        | tableCount >= 1 → pass                            |
| 7   | aeo-definition-pattern | answer    | 정의 패턴         | 8        | "~는 ", "~이란 ", "~의미는" 3개 이상 → pass       |
| 8   | aeo-step-pattern       | structure | 단계별 설명       | 8        | "1단계", "먼저", "다음으로" 2개 이상 → pass       |
| 9   | aeo-concise-sentences  | format    | 간결 문장         | 7        | 문장 평균 길이 40자 이하 → pass                   |
| 10  | aeo-how-what-why       | answer    | How/What/Why 커버 | 8        | "어떻게/무엇/왜" 2종 이상 → pass                  |
| 11  | aeo-summary-present    | format    | 요약 섹션         | 8        | "요약", "정리", "핵심" 키워드 라인 → pass         |
| 12  | aeo-answer-depth       | answer    | 답변 깊이         | 8        | 질문당 답변 150자 이상 → pass                     |

**AC:** ANALYSIS_RULES에 12개 AEO 규칙 추가, domain="aeo".

---

## Task 3: GEO 12규칙 (100점)

**File:** `apps/app/src/features/content-studio/lib/analysis-rules.ts`

GEO (Generative Engine Optimization): 생성형 AI가 신뢰할 수 있는 콘텐츠로 인식하기 위한 최적화.

### 규칙 목록

| #   | ID                       | Category  | Label         | MaxScore | 체크 로직                                        |
| --- | ------------------------ | --------- | ------------- | -------- | ------------------------------------------------ |
| 1   | geo-source-citation      | authority | 출처 인용     | 10       | citationCount >= 2 → pass, 1 → partial           |
| 2   | geo-expert-quote         | authority | 전문가 인용   | 8        | quotationCount >= 1 → pass                       |
| 3   | geo-statistics           | authority | 통계 데이터   | 10       | statisticCount >= 3 → pass, 1-2 → partial        |
| 4   | geo-vocabulary-diversity | quality   | 어휘 다양성   | 8        | uniqueWordRatio >= 0.4 → pass, 0.3-0.4 → partial |
| 5   | geo-publish-date         | freshness | 발행일 표기   | 7        | datePublished 설정됨 → pass                      |
| 6   | geo-factual-density      | authority | 사실 밀도     | 8        | (citation+quote+stat)/1000자 >= 2 → pass         |
| 7   | geo-content-depth        | quality   | 콘텐츠 깊이   | 10       | 2000자 이상 + h2 3개 이상 → pass                 |
| 8   | geo-unique-insight       | quality   | 독창적 관점   | 8        | "경험", "사례", "직접" 패턴 2개 이상 → pass      |
| 9   | geo-evidence-based       | authority | 근거 기반     | 8        | citation+stat >= 3 → pass                        |
| 10  | geo-logical-structure    | quality   | 논리적 구조   | 7        | "결론", "따라서", "요약하면" 패턴 → pass         |
| 11  | geo-entity-mention       | authority | 개체명 언급   | 8        | 대문자/한글 고유명사 2개 이상 → pass             |
| 12  | geo-update-recency       | freshness | 최신 업데이트 | 8        | dateModified 60일 이내 → pass                    |

**AC:** ANALYSIS_RULES에 12개 GEO 규칙 추가, domain="geo".

---

## Task 4: SeoChecklist 도메인별 그룹화

**File:** `apps/app/src/features/content-studio/components/editor/seo-checklist.tsx`

**What:**

1. Props를 `byDomain` + `byCategory`로 확장 (또는 `byDomain` 활용)
2. 도메인별 섹션 헤더 추가: `SEO`, `AEO`, `GEO`
3. 각 도메인 내에서 카테고리별 접이식 표시
4. `CATEGORY_LABELS`에 AEO/GEO 카테고리 추가:
   - `answer: "답변"`, `format: "형식"` (AEO)
   - `authority: "권위"`, `quality: "품질"`, `freshness: "신선도"` (GEO)
5. 도메인별 점수 소계 표시

**AC:** 3도메인이 시각적으로 구분되어 표시됨.

---

## Task 5: SeoPanel 도메인별 점수 표시

**File:** `apps/app/src/features/content-studio/components/editor/seo-panel.tsx`

**What:**

1. `useAnalysisScore`에서 `domainScores`, `byDomain` 추가 사용
2. 기존 단일 게이지 유지 (totalScore) + 하단에 도메인별 미니 진행률 바 추가:
   ```
   SEO  ████████░░  80%
   AEO  ██████░░░░  60%
   GEO  ████░░░░░░  40%
   ```
3. `SeoChecklist`에 `byDomain` prop 전달

**AC:** 도메인별 점수가 시각적으로 표시됨.

---

## Task 6: 빌드 검증 + 문서 업데이트 + 커밋

1. `pnpm --filter app build` 성공 확인
2. Obsidian 인덱스 업데이트: 규칙 수 24→48
3. Reference 문서: features-frontend.md 갱신
4. Git commit on `feature/seo-aeo-geo-phase1` 브랜치

---

## 의존성 순서

```
Task 1 (텍스트 파서) → Task 2 (AEO 규칙) → Task 3 (GEO 규칙)
                                                     ↓
                                    Task 4 (체크리스트 UI) + Task 5 (점수 UI)
                                                     ↓
                                               Task 6 (검증)
```

Task 1→2→3은 같은 파일이므로 순차. Task 4, 5는 병렬 가능.
