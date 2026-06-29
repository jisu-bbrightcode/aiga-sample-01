# Studio AI Suggest Frontend Design

## Goal

Content Studio 캔버스에서 TopicNode 기반 AI 콘텐츠 추천 및 초안 생성 프론트엔드를 구현한다.

## Architecture

TopicNode 선택 시 컨텍스트 액션 바를 표시하고, "AI 추천" 버튼 클릭으로 오른쪽 Side Panel을 열어 추천 목록을 표시한다. 추천 카드에서 "초안 생성"을 클릭하면 generate API를 호출하여 캔버스에 새 ContentNode를 추가한다. AI Recurrence(자동 반복) 관리도 같은 Panel 내에서 제공한다.

## Tech Stack

- React + TanStack Query + tRPC client
- Jotai (UI 상태: 패널 열림, 선택된 Topic)
- shadcn/ui 컴포넌트
- Tailwind CSS

---

## Components

### 1. TopicContextBar

TopicNode 선택 시 노드 상단에 떠있는 컨텍스트 액션 바.

- 위치: 선택된 TopicNode 위 (React Flow NodeToolbar 또는 absolute position)
- 버튼: `[AI 추천]` `[편집]` `[삭제]`
- "AI 추천" 클릭 → `aiPanelOpenAtom = true`, `aiPanelTopicAtom` 설정

### 2. AiSuggestPanel

캔버스 오른쪽에 슬라이드되는 Side Panel (330px).

**구성:**
1. **헤더**: Topic 이름 + 닫기 버튼
2. **프롬프트 입력**: 선택적 방향 제시 (예: "SEO 관련 콘텐츠")
3. **"추천 생성" 버튼**: suggest API 호출
4. **추천 목록**: SuggestionCard × N (보통 3-5개)
   - 각 카드: title, description, nodeType 배지, relevance 배지
   - "초안 생성" 버튼 → generate API
5. **AI Recurrence 섹션**: 접이식, 자동 반복 규칙 관리

### 3. SuggestionCard

추천 항목 하나를 표시하는 카드.

- title (text-sm font-medium)
- description (text-sm text-muted-foreground, 2-3줄)
- nodeType 배지 (text-xs, bg-muted rounded)
- relevance 배지 (text-xs)
- "초안 생성" Button (outline, 카드 하단)
- 생성 중: spinner + disabled

### 4. AiRecurrenceManager

AI 반복 규칙 CRUD. RecurrenceManager 패턴 유사.

- 목록: AiRecurrenceRow (규칙명, 주기, 다음 실행일, 활성/비활성 토글)
- 생성/수정 폼: topicId 선택 (canvasData.topics에서), prompt, rule(weekly/biweekly/monthly)
- Dialog가 아닌 Panel 내부 inline 폼

## State Management

```typescript
// store/canvas-store.ts 추가
export const aiPanelOpenAtom = atom(false);
export const aiPanelTopicAtom = atom<{ id: string; label: string } | null>(null);
```

## Hooks

### use-ai-suggest.ts

```typescript
export function useAiSuggest(studioId: string) { ... }
// contentStudio.ai.suggest mutation

export function useAiGenerate(studioId: string) { ... }
// contentStudio.ai.generate mutation
// onSuccess: invalidate canvas data

export function useAiSuggestAndGenerate(studioId: string) { ... }
// contentStudio.ai.suggestAndGenerate mutation
// onSuccess: invalidate canvas data
```

### use-ai-recurrence.ts

```typescript
export function useAiRecurrences(studioId: string) { ... }
// contentStudio.ai.recurrence.list query

export function useAiRecurrenceMutations(studioId: string) { ... }
// create, update, delete, toggle mutations
// onSuccess: invalidate recurrence list
```

## Data Flow

```
TopicNode 클릭
  → selectedNodeAtom 업데이트
  → TopicContextBar 표시

"AI 추천" 클릭
  → aiPanelOpenAtom = true
  → aiPanelTopicAtom = { id, label }

AiSuggestPanel 렌더링
  → 프롬프트 입력 (optional)
  → "추천 생성" 클릭
  → contentStudio.ai.suggest mutation
  → 추천 카드 목록 표시

SuggestionCard "초안 생성" 클릭
  → contentStudio.ai.generate mutation
  → onSuccess: invalidate canvas query → 캔버스에 새 ContentNode 표시

CanvasToolbar (빠른 생성)
  → Topic 선택 상태 + 프롬프트 입력
  → contentStudio.ai.suggestAndGenerate mutation
  → onSuccess: invalidate canvas query
```

## UX States

| 상태 | UI |
|------|-----|
| Panel 닫힘 | 캔버스 전체 표시 |
| Panel 열림 (초기) | "이 주제에 대한 AI 추천을 생성해보세요" + CTA |
| Loading (suggest) | Skeleton × 3 |
| Loading (generate) | 해당 카드에 spinner, 버튼 disabled |
| 추천 결과 | SuggestionCard × N |
| Error | 에러 메시지 + "다시 시도" 버튼 |
| 생성 완료 | 카드에 체크 표시, 캔버스 업데이트 |

## Files

| 파일 | 종류 | 설명 |
|------|------|------|
| `components/ai-suggest-panel.tsx` | 신규 | Side Panel 메인 컴포넌트 |
| `components/canvas/topic-context-bar.tsx` | 신규 | TopicNode 컨텍스트 액션 바 |
| `components/ai-recurrence-manager.tsx` | 신규 | AI 반복 규칙 관리 |
| `hooks/use-ai-suggest.ts` | 신규 | AI suggest/generate hooks |
| `hooks/use-ai-recurrence.ts` | 신규 | AI recurrence CRUD hooks |
| `hooks/index.ts` | 수정 | 새 hooks export |
| `store/canvas-store.ts` | 수정 | aiPanelOpenAtom, aiPanelTopicAtom |
| `pages/canvas-page.tsx` | 수정 | TopicContextBar, AiSuggestPanel 통합 |
