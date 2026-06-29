# FEA-148: Screen/Edge Flow Model + Detail Panel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 선형 화면 목록을 edge 기반 흐름 모델로 전환하고, 노드/엣지 선택형 상세 패널을 구현한다.

**Architecture:** 기존 `flowData` JSONB를 `edges: FlowEdge[]` 배열로 확장. `generateScreenCandidates` API로 화면 후보 + edge를 함께 생성. 프론트엔드는 React Flow 기반 캔버스 + Jotai 패널 상태로 구현.

**Tech Stack:** Drizzle (JSONB 확장), NestJS Service, tRPC, REST+Swagger, React Flow (@xyflow/react), dagre (auto-layout), Jotai (panel state), TanStack Query

---

## Task 1: FlowEdge 타입 + FlowData 확장

**Files:**
- Modify: `packages/features/agent-desk/types/index.ts`

**Step 1: FlowEdge 타입 정의 + FlowData 확장**

```typescript
// types/index.ts에 추가
export interface FlowEdge {
  id: string;
  fromScreenId: string;
  toScreenId: string;
  conditionLabel: string;
  transitionType: "navigate" | "redirect" | "modal" | "conditional";
  sourceRequirementIds: string[];
}

export type PanelMode = "closed" | "view" | "edit" | "preview";

export interface PanelState {
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  mode: PanelMode;
  activeTab: string;
  dirty: boolean;
}

// 기존 FlowScreen에 확장 필드 추가
export interface ScreenDetail {
  screenGoal?: string;
  primaryUser?: string;
  routePath?: string;
  routeParent?: string;
  keyElements?: string[];
  inputs?: string[];
  actions?: string[];
  states?: string[];
  entryConditions?: string[];
  exitConditions?: string[];
  sourceRequirementIds?: string[];
  notes?: string;
}
```

FlowData 인터페이스에 `edges` 필드 추가 (기존 screens/currentScreenIndex 유지).

**Step 2: Commit**

---

## Task 2: DTO 정의 (generateScreenCandidates, selectNode/Edge, updateEdge)

**Files:**
- Create: `packages/features/agent-desk/dto/screen-candidate.dto.ts`
- Modify: `packages/features/agent-desk/dto/index.ts`

**DTOs:**
- `generateScreenCandidatesSchema`: { sessionId, model? }
- `selectCanvasNodeSchema`: { sessionId, nodeId, panelMode: "view" | "edit" }
- `selectCanvasEdgeSchema`: { sessionId, edgeId, panelMode: "view" }
- `updateFlowEdgeSchema`: { sessionId, edgeId, conditionLabel?, transitionType? }
- `updateScreenCandidateSchema`: { sessionId, screenId, screenGoal?, keyElements?, entryConditions?, exitConditions?, sourceRequirementIds?, ... }

**Step 1: DTO 파일 작성**
**Step 2: index.ts에 re-export**
**Step 3: Commit**

---

## Task 3: ScreenCandidateService 구현

**Files:**
- Create: `packages/features/agent-desk/service/screen-candidate.service.ts`
- Modify: `packages/features/agent-desk/service/index.ts`

**Methods:**
- `generateCandidates(input, userId)`: LLM으로 requirement에서 화면 후보 + edge + flowchart Mermaid 생성 → flowData에 저장
- `updateScreenDetail(input, userId)`: 화면 상세 필드 업데이트 (screenGoal, keyElements 등)
- `updateFlowEdge(input, userId)`: edge의 conditionLabel/transitionType 업데이트
- `selectNode(input, userId)`: panelState 반환 (서버 저장 없이 응답만)
- `selectEdge(input, userId)`: panelState 반환

`generateCandidates` LLM 프롬프트는 requirement 목록을 입력받아 screens[] + edges[] + flowchartMermaid를 JSON으로 반환. 기존 `AnalyzerService.generateScreensFromAnalysis()` 패턴 참조.

**Step 1: Service 작성**
**Step 2: index.ts에 export**
**Step 3: Commit**

---

## Task 4: tRPC Router + REST Controller 추가

**Files:**
- Modify: `packages/features/agent-desk/trpc/agent-desk.route.ts`
- Modify: `packages/features/agent-desk/controller/agent-desk.controller.ts`

**tRPC 프로시저 (5개):**
- `generateScreenCandidates` (mutation)
- `selectCanvasNode` (mutation)
- `selectCanvasEdge` (mutation)
- `updateScreenCandidate` (mutation)
- `updateFlowEdge` (mutation)

**REST 엔드포인트 (5개):**
- `POST /api/agent-desk/screens/generate`
- `POST /api/agent-desk/canvas/select-node`
- `POST /api/agent-desk/canvas/select-edge`
- `PATCH /api/agent-desk/screens/:screenId`
- `PATCH /api/agent-desk/edges/:edgeId`

**Step 1: tRPC 프로시저 추가**
**Step 2: REST 엔드포인트 + Swagger**
**Step 3: Commit**

---

## Task 5: Module 등록 + TypeScript 빌드 검증

**Files:**
- Modify: `packages/features/agent-desk/agent-desk.module.ts`

**Step 1: ScreenCandidateService를 Module에 등록 (providers, exports, constructor, onModuleInit)**
**Step 2: `pnpm -F server tsc --noEmit` 통과 확인**
**Step 3: Commit**

---

## Task 6: Unit Tests

**Files:**
- Create: `packages/features/agent-desk/service/screen-candidate.service.spec.ts`

**Test Cases:**
- generateCandidates: 정상 생성, requirement 없으면 빈 결과, LLM 응답 파싱 실패
- updateScreenDetail: 정상 업데이트, 존재하지 않는 screenId
- updateFlowEdge: 정상 업데이트, 존재하지 않는 edgeId
- selectNode/selectEdge: panelState 반환 확인
- 소유권 검증

**Step 1: spec 파일 작성**
**Step 2: 테스트 실행 확인**
**Step 3: Commit**

---

## Task 7: Frontend - Panel State Atoms (Jotai)

**Files:**
- Create: `apps/app/src/features/agent-desk/store/flow-canvas.atoms.ts`
- Create: `apps/app/src/features/agent-desk/hooks/use-flow-canvas.ts`

**Atoms:**
- `panelStateAtom`: PanelState (selectedNodeId, selectedEdgeId, mode, activeTab, dirty)
- `flowEdgesAtom`: derived from flowData query

**Hook: `useFlowCanvas()`**
- `selectNode(nodeId, mode)`: 노드 선택 + panel open
- `selectEdge(edgeId)`: 엣지 선택 + panel open
- `closePanel()`: panel 닫기
- `setDirty(dirty)`: dirty 상태 설정
- `confirmNavigation()`: dirty 시 경고 표시

**Step 1: Atoms 파일 작성**
**Step 2: Hook 파일 작성**
**Step 3: Commit**

---

## Task 8: Frontend - tRPC Hooks

**Files:**
- Create: `apps/app/src/features/agent-desk/hooks/use-screen-candidate-mutations.ts`

**Hooks:**
- `useGenerateScreenCandidates()`: mutation + flowData cache invalidation
- `useUpdateScreenCandidate()`: mutation + invalidation
- `useUpdateFlowEdge()`: mutation + invalidation

**Step 1: Hook 파일 작성**
**Step 2: Commit**

---

## Task 9: Frontend - React Flow Canvas Component

**Files:**
- Create: `apps/app/src/features/agent-desk/components/flow-canvas.tsx`
- Create: `apps/app/src/features/agent-desk/components/flow-screen-node.tsx`
- Create: `apps/app/src/features/agent-desk/components/flow-edge-component.tsx`

**flow-canvas.tsx:**
- React Flow 기반 캔버스
- dagre 자동 레이아웃 (screens → nodes, edges → edges)
- flowData → React Flow nodes/edges 변환
- 노드 single click → selectNode(view)
- 노드 double click → selectNode(edit)
- 엣지 click → selectEdge(view)

**flow-screen-node.tsx:**
- Custom node: 화면 이름 + 설명 + 배지 (requirement count)
- 선택 상태 하이라이팅

**flow-edge-component.tsx:**
- Custom edge: 조건 라벨 표시
- 선택 상태 하이라이팅

**Step 1: Custom node 컴포넌트**
**Step 2: Custom edge 컴포넌트**
**Step 3: Canvas 메인 컴포넌트 (dagre layout + event handlers)**
**Step 4: Commit**

---

## Task 10: Frontend - Detail Panel Component

**Files:**
- Create: `apps/app/src/features/agent-desk/components/screen-detail-panel.tsx`
- Create: `apps/app/src/features/agent-desk/components/edge-detail-panel.tsx`
- Create: `apps/app/src/features/agent-desk/components/detail-panel.tsx`

**detail-panel.tsx (router):**
- panelState.mode === "closed" → null
- selectedNodeId → ScreenDetailPanel
- selectedEdgeId → EdgeDetailPanel

**screen-detail-panel.tsx:**
- 탭: 개요 | UI 구성 | 인터랙션 | 상태 | 근거 | 산출물
- view mode: 읽기 전용 표시
- edit mode: React Hook Form으로 편집
- dirty 상태 경고
- requirement 링크 표시

**edge-detail-panel.tsx:**
- 전이 상세: from → to, conditionLabel, transitionType
- sourceRequirementIds 표시
- view mode + edit mode

**Step 1: detail-panel.tsx (라우터)**
**Step 2: screen-detail-panel.tsx (뷰/편집)**
**Step 3: edge-detail-panel.tsx (뷰/편집)**
**Step 4: Commit**

---

## Task 11: Frontend - FlowDesigner 페이지 통합

**Files:**
- Modify: `apps/app/src/features/agent-desk/pages/flow-designer.tsx`

**변경:**
- 기존 FlowPanel(리스트) → FlowCanvas(React Flow) 교체
- 기존 WireframePreview → DetailPanel 교체
- "화면 후보 생성" 버튼 추가 → useGenerateScreenCandidates
- requirement 목록에서 화면 점프 (requirement click → selectNode + fitView)
- dirty 상태에서 전환 시 경고 다이얼로그

**Step 1: FlowDesigner 페이지 수정**
**Step 2: Commit**

---

## Task 12: Frontend TypeScript 빌드 검증

**Step 1: `cd apps/app && pnpm tsc --noEmit` 통과 확인**
**Step 2: lint 확인**

---

## Task 13: Migration 적용 + 런타임 검증

**Step 1: Migration 불필요 (JSONB 확장만, 스키마 변경 없음)**
**Step 2: 서버 실행 후 API curl 테스트**
**Step 3: 브라우저 렌더링 검증**

---

## Task 14: 레퍼런스 문서 업데이트

**Files:**
- Modify: `docs/reference/features-backend.md`
- Modify: `docs/reference/features-frontend.md`

**Step 1: Backend 문서 갱신 (새 서비스, DTO, tRPC 프로시저 수)**
**Step 2: Frontend 문서 갱신 (새 컴포넌트, hooks)**
**Step 3: Commit**
