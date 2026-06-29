# Claude Code Feature Issue Template

Linear Issue 본문에 그대로 붙여넣어 사용할 템플릿이다.

권장 제목 규칙:
`[E{Epic번호}] {Story 제목}`

예시:
`[E6] UI 스펙 계약 생성`

---

## Context
- Linear Team: `FEA` 예시
- Linear Project:
- FRD IDs:
- 상위 문서:
  - FRD:
  - Architecture:
  - UI MCP 계약:
  - QA:
  - 화면정의:
- 관련 기능/화면:
- 관련 코드 경로:

## Goal
- 이번 Issue에서 최종적으로 동작해야 하는 사용자 가치 1-2문장

## Scope
### In Scope
- 
- 

### Out of Scope
- 
- 

## Inputs
### 데이터 계약
- `handoffVersion`:
- `storyIds`:
- `groupingMode`: `story-to-issue`
- `draftKey`:
- 영향을 받는 모델:
- 영향을 받는 API:
- Product Builder Linear 게시:
  - `previewLinearIssues`: yes/no
  - `createLinearIssues`: yes/no
  - `getLinearPublishStatus`: yes/no
- implementation handoff 영향:
  - `routerMap`: yes/no
  - `screenSpecs`: yes/no
  - `uiSpecs`: yes/no
  - `navigationRules`: yes/no

### UI 기준
- `@repo/ui` 우선순위:
  1. `@repo/ui/shadcn/*`
  2. `@repo/ui/components/*`
  3. `@repo/ui/layouts/*`
  4. `shadcn-studio blocks`
- Product Builder UI reference 사용 여부:
- fallback 문서:
  - `docs/reference/ui-components.md`

### 참고 문서
- 
- 

## Acceptance Criteria
- [ ] 
- [ ] 
- [ ] 

## Deliverables
### 코드
- 수정 파일:
- 신규 파일:

### 문서
- 갱신할 Obsidian 문서:
- 갱신할 reference 문서:

### Linear 게시 결과
- publish job:
- 생성 대상 issue:
- 생성 대상 sub-issue:
- 저장할 식별자:
- 저장할 URL:

### 검증
- 테스트:
- 수동 검증:

## UI Spec Contract
해당 Issue가 UI를 포함하면 반드시 채운다.

### Screen / Route
- `screenId`:
- `routePath`:
- `routeParent`:
- `authRule`:

### Layout
- `layoutType`:
- 주요 섹션 순서:

### Components
- 주요 컴포넌트:
  - `type`:
  - `source`: `shadcn | custom | layout | block`
  - `importPath`:
  - `reason`:

### States
- `loading`:
- `empty`:
- `error`:
- `disabled`:
- `permissionDenied`:

### Responsive
- `mobile`:
- `tablet`:
- `desktop`:

## Handoff Contract
- 구현 완료 후 `implementation handoff`에 반영되어야 하는 항목:
- Atlas가 Linear 본문에 자동 포함해야 하는 링크:
  - FRD:
  - Architecture:
  - UI MCP 계약:
  - QA:
  - 관련 코드 경로:
- unresolved 발생 시 기록할 `todo_reason`:

## Constraints
- raw HTML element로 대체하지 말 것
- `@repo/ui`에 존재하는 컴포넌트를 우선 사용할 것
- Product Builder UI reference 결과가 있으면 `source`, `importPath`를 그대로 사용할 것
- 동일 `draftKey` 재시도는 중복 생성이 아니라 기존 결과 재사용이어야 할 것
- 확정할 수 없는 값은 숨기지 말고 `todo_reason`으로 남길 것
- scope 밖의 리팩터링은 하지 말 것

## Claude Code Kickoff
이 Issue를 구현하라.
반드시 FRD, Architecture, UI MCP 계약, QA를 먼저 읽고,
`implementation handoff`와 `uiSpecs` 계약을 깨지 말 것.
작업 후 코드, 테스트, 문서 갱신까지 완료할 것.
