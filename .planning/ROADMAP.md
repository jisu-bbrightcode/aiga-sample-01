# Roadmap — StoryEditor Single-Authority (FLE-88)

## Phase 1: StoryEditor Public Rendering Surface ✅
**Goal:** StoryEditor editable/readonly 두 모드가 같은 렌더 계약을 공유하는 public API 확정. 이름뿐 facade가 아니라 실제 책임 경계를 StoryEditor 안으로 이동.
**Requirements:** REQ-001, REQ-002, REQ-003
**Depends on:** None

## Phase 2: StoryGraph 역할 축소 ✅
**Goal:** StoryGraph가 node bounds + active session + commit/cancel만 알도록 축소. readonly 렌더 세부, painter, snapshot 정책을 StoryEditor 측으로 이동.
**Requirements:** REQ-004, REQ-005
**Depends on:** Phase 1

## Phase 3: Source-Guard 강화 ✅
**Goal:** StoryGraph → graph-engine renderer helper 직접 import 금지 테스트, document template 본문용 text block 금지, document bindings doc 외 본문 파생 값 금지.
**Requirements:** REQ-006
**Depends on:** Phase 2

## Phase 4: "editor" Block Tag
**Goal:** template에 `tag: "editor"` 선언만으로 document 노드처럼 동작하는 인터랙티브 에디터 노드 완성. use-inline-document-editor.tsx 200줄 보일러플레이트를 엔진 내부로 흡수.
**Requirements:** REQ-007, REQ-008, REQ-009, REQ-010
**Depends on:** Phase 3
**Plans:** 3 plans

Plans:
- [ ] 04-01-PLAN.md — editor block tag handler (L2 readonly atlas paint)
- [ ] 04-02-PLAN.md — EditorOverlayManager (L4 DOM overlay lifecycle)
- [ ] 04-03-PLAN.md — Consumer migration + template update + verification
