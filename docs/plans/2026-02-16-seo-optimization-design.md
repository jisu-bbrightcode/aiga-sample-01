# SEO 자동 최적화 — 설계 문서

## 목적

에디터에서 콘텐츠 작성 중 실시간 SEO 점수를 제공하고, AI 기반 키워드 리서치 + 내부 링크 추천으로 검색 최적화를 자동화한다.

## 스콥

- **MVP (Phase 1)**: 실시간 SEO 스코어 + 확장 가능한 체크리스트 + AI 키워드 리서치 + 내부 링크 추천
- **Phase 2**: SERP 순위 추적, 외부 API 연동 (Google Search Console), 콘텐츠 갱신 알림, Schema Markup

## 아키텍처

하이브리드 접근: 기본 체크리스트는 **클라이언트 사이드 실시간 계산**, 키워드 리서치는 **백엔드 AI (LLMService)**.

```
EditorPage
├── 에디터 영역 (좌측)
│   └── [금칙어 배너] (기존)
└── MetaPanel (우측 280px) — Tabs 구조
    ├── Tab: 메타 (기존 UI 그대로)
    └── Tab: SEO
        ├── ScoreGauge (원형 0~100)
        ├── ChecklistSection (카테고리별 접이식)
        │   ├── 콘텐츠 (제목 길이, 본문 길이, 이미지, alt 텍스트, 가독성)
        │   ├── 메타 (메타 설명, slug)
        │   ├── 구조 (H2/H3, 키워드 제목/소제목/첫문단/밀도/메타/slug)
        │   └── 링크 (내부, 외부)
        ├── KeywordResearch
        │   ├── 현재 키워드 태그 (추가/삭제)
        │   ├── [AI 키워드 추천] 버튼 → 결과 리스트
        │   └── 키워드별 밀도 표시
        └── InternalLinkSuggestions (관련 콘텐츠 3~5개)
```

## 확장 가능한 체크리스트 규칙 시스템

```typescript
interface SeoRule {
  id: string;
  category: "content" | "meta" | "structure" | "link";
  label: string;
  description: string;
  maxScore: number;
  check: (ctx: SeoContext) => SeoCheckResult;
}

interface SeoContext {
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
}

interface SeoCheckResult {
  status: "pass" | "partial" | "fail";
  score: number;
  message: string;
}
```

새 규칙 추가 = 함수 하나 작성 + 배열에 push.

## SEO 체크리스트 (16개 규칙, 총 100점)

| # | 카테고리 | 항목 | 기준 | 배점 |
|---|----------|------|------|------|
| 1 | content | 제목 길이 | 30~60자 | 8 |
| 2 | content | 본문 길이 | 300자 이상 | 8 |
| 3 | content | 이미지 포함 | 1개 이상 | 5 |
| 4 | content | 이미지 alt 텍스트 | 모든 이미지에 alt 존재 | 5 |
| 5 | content | 가독성 | 문단 평균 3~5문장, 짧은 문장 비율 | 5 |
| 6 | meta | 메타 설명 길이 | 100~160자 | 8 |
| 7 | meta | URL slug 존재 | 제목 기반 slug | 5 |
| 8 | structure | H2/H3 사용 | H2 1개 이상 | 7 |
| 9 | structure | 키워드 제목 포함 | seoKeywords 중 1개+ 제목에 존재 | 7 |
| 10 | structure | 키워드 소제목 포함 | seoKeywords 중 1개+ H2/H3에 존재 | 5 |
| 11 | structure | 키워드 첫 문단 포함 | 첫 100자 내 키워드 출현 | 7 |
| 12 | structure | 키워드 밀도 | 본문 1~3% | 7 |
| 13 | structure | 키워드 메타 설명 포함 | seoKeywords 중 1개+ 메타 설명에 존재 | 5 |
| 14 | structure | 키워드 slug 포함 | seoKeywords 중 1개+ slug에 존재 | 5 |
| 15 | link | 내부 링크 | 1개 이상 | 7 |
| 16 | link | 외부 링크 | 1개 이상 | 6 |

## 키워드 리서치 도구 (AI)

```typescript
// 백엔드 AI 프로시저
seo.suggestKeywords(input: {
  studioId: string;
  contentId: string;
  title: string;
  bodyText: string;        // 첫 500자
  currentKeywords: string[];
}) → {
  mainKeywords: { keyword: string; reason: string }[];      // 핵심 3~5개
  longTailKeywords: { keyword: string; reason: string }[];  // 롱테일 5~7개
  questionKeywords: string[];   // 질문형 키워드 3~5개
  relatedQueries: string[];    // 관련 검색어 3~5개
}
```

## 내부 링크 추천

같은 스튜디오 내 콘텐츠 목록을 가져와 제목/요약 기반 키워드 매칭으로 관련도 높은 3~5개 추천.

## 백엔드 변경

| 변경 | 설명 |
|------|------|
| `studio_contents`에 `slug` 추가 | 콘텐츠 URL slug |
| `studio_content_seo`에 `seoScore` 추가 | 스냅샷 저장 시 점수 기록 |
| `StudioSeoService` 신규 | AI 키워드 추천 + 내부 링크 조회 |
| tRPC `seo.suggestKeywords` | AI 키워드 추천 프로시저 |
| tRPC `seo.studioContents` | 같은 스튜디오 콘텐츠 목록 (링크 추천용) |

## 프론트엔드 파일 구성

| 파일 | 역할 |
|------|------|
| `lib/seo-rules.ts` | 규칙 정의 + SeoContext/SeoRule 타입 |
| `hooks/use-seo-score.ts` | 규칙 실행 + 총점 계산 (useMemo) |
| `hooks/use-keyword-research.ts` | AI 키워드 추천 mutation |
| `hooks/use-internal-links.ts` | 내부 링크 추천 로직 |
| `components/editor/seo-panel.tsx` | SEO 탭 메인 UI |
| `components/editor/seo-score-gauge.tsx` | 원형 게이지 컴포넌트 |
| `components/editor/seo-checklist.tsx` | 체크리스트 (카테고리별 접이식) |
| `components/editor/keyword-research.tsx` | 키워드 리서치 섹션 |
| `components/editor/internal-link-suggestions.tsx` | 내부 링크 추천 |
| `meta-panel.tsx` 수정 | Tabs 구조로 확장 |

## 참고

- [AIOSEO SEO Checklist](https://aioseo.com/seo-checklist/) — 체크리스트 항목 참고
- Yoast SEO — 실시간 점수 UI 참고
- Surfer SEO — 키워드 리서치 + 콘텐츠 최적화 참고
