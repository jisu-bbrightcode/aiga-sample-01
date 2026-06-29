export type DesignSystemGroupId = "foundation" | "components" | "patterns";

export interface DesignSystemSection {
  id: string;
  title: string;
  group: DesignSystemGroupId;
  description: string;
  sourcePaths: string[];
}

export interface DesignSystemGroup {
  id: DesignSystemGroupId;
  title: string;
}

export const DESIGN_SYSTEM_GROUPS: DesignSystemGroup[] = [
  { id: "foundation", title: "Foundation" },
  { id: "components", title: "Components" },
  { id: "patterns", title: "Patterns" },
];

export const DESIGN_SYSTEM_SECTIONS: DesignSystemSection[] = [
  {
    id: "colors",
    title: "Colors",
    group: "foundation",
    description: "현재 앱 테마에서 실제로 쓰는 색상 표면.",
    sourcePaths: ["packages/ui/src/styles.css", "apps/app/src/styles.css"],
  },
  {
    id: "typography",
    title: "Typography",
    group: "foundation",
    description: "화면 제목, 섹션 제목, 본문, 보조 텍스트의 실제 계층.",
    sourcePaths: ["packages/ui/src/styles.css"],
  },
  {
    id: "spacing",
    title: "Spacing",
    group: "foundation",
    description: "툴바, 카드, 페이지 섹션에서 반복되는 간격 리듬.",
    sourcePaths: [
      "packages/ui/src/components/page-layout.tsx",
      "apps/app/src/pages/settings/_shared/SettingPageLayout.tsx",
    ],
  },
  {
    id: "radius-shadow",
    title: "Radius / Shadow",
    group: "foundation",
    description: "카드, 오버레이, 행, 배지의 형태와 깊이.",
    sourcePaths: [
      "packages/ui/src/_shadcn/card.tsx",
      "packages/ui/src/_shadcn/popover.tsx",
      "packages/ui/src/_shadcn/dialog.tsx",
    ],
  },
  {
    id: "buttons",
    title: "Buttons",
    group: "components",
    description: "공유 버튼의 실제 상태와 밀도.",
    sourcePaths: ["packages/ui/src/_shadcn/button.tsx"],
  },
  {
    id: "inputs",
    title: "Inputs",
    group: "components",
    description: "입력, 긴 입력, 검증 인접 상태.",
    sourcePaths: ["packages/ui/src/_shadcn/input.tsx", "packages/ui/src/_shadcn/textarea.tsx"],
  },
  {
    id: "custom-caret",
    title: "Custom Caret",
    group: "components",
    description: "native caret을 숨기고 selection 좌표 기반 overlay로 그리는 editor caret 실험.",
    sourcePaths: ["apps/app/src/pages/designsystem/designsystem-page.tsx"],
  },
  {
    id: "card",
    title: "Card",
    group: "components",
    description: "기본 카드 표면과 프로젝트 목록에서 실제로 쓰는 stacked card 패턴.",
    sourcePaths: [
      "packages/ui/src/_shadcn/card.tsx",
      "packages/ui/src/components/stacked-card.tsx",
      "apps/app/src/features/project/components/project-card.tsx",
      "apps/app/src/features/project/pages/project-list-page.tsx",
    ],
  },
  {
    id: "paper-card",
    title: "Paper Card",
    group: "components",
    description: "프로젝트 목록에서 실제로 쓰는 책형 stacked card 표면.",
    sourcePaths: [
      "apps/app/src/features/project/components/project-card.tsx",
      "apps/app/src/features/project/pages/project-list-page.tsx",
      "packages/ui/src/components/stacked-card.tsx",
    ],
  },
  {
    id: "checkbox",
    title: "Checkbox",
    group: "components",
    description: "표시 속성, 다중 선택, 포함/제외 상태에 쓰는 체크 컨트롤.",
    sourcePaths: ["packages/ui/src/_shadcn/checkbox.tsx", "packages/ui/src/_shadcn/field.tsx"],
  },
  {
    id: "radio-group",
    title: "Radio Group",
    group: "components",
    description: "단일 범위, 상태 필터, 보기 옵션을 고르는 라디오 그룹.",
    sourcePaths: ["packages/ui/src/_shadcn/radio-group.tsx", "packages/ui/src/_shadcn/field.tsx"],
  },
  {
    id: "switch",
    title: "Switch",
    group: "components",
    description: "설정, 표시 여부, 기능 on/off에 쓰는 스위치.",
    sourcePaths: ["packages/ui/src/_shadcn/switch.tsx", "packages/ui/src/_shadcn/field.tsx"],
  },
  {
    id: "toggle-group",
    title: "Toggle Group",
    group: "components",
    description: "툴바와 사이드바에서 쓰는 단일/다중 토글 버튼 그룹.",
    sourcePaths: [
      "packages/ui/src/_shadcn/toggle-group.tsx",
      "packages/ui/src/components/icon-toggle.tsx",
    ],
  },
  {
    id: "slider",
    title: "Slider",
    group: "components",
    description: "강도, 진행 값, 수치 조정에 쓰는 슬라이더.",
    sourcePaths: ["packages/ui/src/_shadcn/slider.tsx"],
  },
  {
    id: "form",
    title: "Form",
    group: "components",
    description: "입력, 라벨, 설명, 검증 메시지를 묶는 shadcn form 패턴.",
    sourcePaths: [
      "packages/ui/src/_shadcn/form.tsx",
      "packages/ui/src/_shadcn/field.tsx",
      "packages/ui/src/_shadcn/input.tsx",
      "packages/ui/src/_shadcn/checkbox.tsx",
    ],
  },
  {
    id: "navigation-controls",
    title: "Navigation",
    group: "components",
    description: "상세 경로, 섹션 전환, 단축키 힌트를 보여주는 내비게이션 primitive.",
    sourcePaths: [
      "packages/ui/src/_shadcn/breadcrumb.tsx",
      "packages/ui/src/_shadcn/tabs.tsx",
      "packages/ui/src/_shadcn/kbd.tsx",
    ],
  },
  {
    id: "toolbar",
    title: "Toolbar",
    group: "components",
    description: "엔티티 목록과 상세 화면에서 쓰는 하위 툴바.",
    sourcePaths: [
      "packages/ui/src/components/entity-subbar.tsx",
      "apps/app/src/features/story/pages/entity-list-view.tsx",
    ],
  },
  {
    id: "sidebar",
    title: "Sidebar",
    group: "components",
    description: "상세 rail 내부에서 반복되는 섹션, 행, 입력, 선택, 토글 컴포넌트.",
    sourcePaths: [
      "packages/ui/src/components/icon-toggle.tsx",
      "packages/ui/src/components/entity-subbar.tsx",
      "apps/app/src/features/story/layouts/detail-layout.tsx",
      "apps/app/src/features/story/pages/entity-detail-page.tsx",
    ],
  },
  {
    id: "popover",
    title: "Popover",
    group: "components",
    description: "짧은 선택과 메타데이터를 담는 오버레이.",
    sourcePaths: [
      "packages/ui/src/_shadcn/popover.tsx",
      "apps/app/src/features/story/components/project-switcher.tsx",
    ],
  },
  {
    id: "combobox",
    title: "Combobox",
    group: "components",
    description: "검색 가능한 단일/다중 선택 입력.",
    sourcePaths: ["packages/ui/src/_shadcn/combobox.tsx"],
  },
  {
    id: "command",
    title: "Command",
    group: "components",
    description: "프로젝트 검색과 빠른 실행에 쓰는 command palette.",
    sourcePaths: ["packages/ui/src/_shadcn/command.tsx"],
  },
  {
    id: "context-menu",
    title: "Context Menu",
    group: "components",
    description: "우클릭/롱프레스에서 여는 행·카드 액션 메뉴.",
    sourcePaths: ["packages/ui/src/_shadcn/context-menu.tsx"],
  },
  {
    id: "dropdown-menu",
    title: "Dropdown Menu",
    group: "components",
    description: "버튼 트리거 기반의 짧은 선택 메뉴와 툴팁 조합.",
    sourcePaths: [
      "packages/ui/src/_shadcn/dropdown-menu.tsx",
      "packages/ui/src/_shadcn/tooltip.tsx",
    ],
  },
  {
    id: "table",
    title: "Table",
    group: "components",
    description: "설정과 엔티티 목록에서 쓰는 밀도 높은 행 구조.",
    sourcePaths: [
      "packages/ui/src/components/entity-table.tsx",
      "apps/app/src/features/story/pages/entity-list-view.tsx",
    ],
  },
  {
    id: "dialog",
    title: "Dialog",
    group: "components",
    description: "짧은 폼과 확인 액션을 위한 집중 모달.",
    sourcePaths: ["packages/ui/src/_shadcn/dialog.tsx"],
  },
  {
    id: "empty-state",
    title: "Empty State",
    group: "components",
    description: "비어 있는 목록과 준비 중 화면의 실제 형태.",
    sourcePaths: [
      "packages/ui/src/components/primitives/empty-state.tsx",
      "packages/ui/src/settings/EmptyComingSoon.tsx",
    ],
  },
  {
    id: "feedback",
    title: "Feedback",
    group: "components",
    description: "저장, 동기화, 오류, 로딩 상태를 보여주는 피드백 primitive.",
    sourcePaths: [
      "packages/ui/src/_shadcn/alert.tsx",
      "packages/ui/src/_shadcn/progress.tsx",
      "packages/ui/src/_shadcn/skeleton.tsx",
      "packages/ui/src/_shadcn/spinner.tsx",
      "packages/ui/src/_shadcn/separator.tsx",
    ],
  },
  {
    id: "ai-components",
    title: "AI Components",
    group: "components",
    description: "shadcn.io AI registry에서 설치한 conversational AI UI 컴포넌트 전체.",
    sourcePaths: [
      "packages/ui/src/components/ai/actions.tsx",
      "packages/ui/src/components/ai/agent.tsx",
      "packages/ui/src/components/ai/artifact.tsx",
      "packages/ui/src/components/ai/attachments.tsx",
      "packages/ui/src/components/ai/audio-player.tsx",
      "packages/ui/src/components/ai/branch.tsx",
      "packages/ui/src/components/ai/canvas.tsx",
      "packages/ui/src/components/ai/chain-of-thought.tsx",
      "packages/ui/src/components/ai/checkpoint.tsx",
      "packages/ui/src/components/ai/code-block.tsx",
      "packages/ui/src/components/ai/commit.tsx",
      "packages/ui/src/components/ai/confirmation.tsx",
      "packages/ui/src/components/ai/connection.tsx",
      "packages/ui/src/components/ai/context.tsx",
      "packages/ui/src/components/ai/controls.tsx",
      "packages/ui/src/components/ai/conversation.tsx",
      "packages/ui/src/components/ai/edge.tsx",
      "packages/ui/src/components/ai/environment-variables.tsx",
      "packages/ui/src/components/ai/file-tree.tsx",
      "packages/ui/src/components/ai/image.tsx",
      "packages/ui/src/components/ai/inline-citation.tsx",
      "packages/ui/src/components/ai/loader.tsx",
      "packages/ui/src/components/ai/message.tsx",
      "packages/ui/src/components/ai/mic-selector.tsx",
      "packages/ui/src/components/ai/model-selector.tsx",
      "packages/ui/src/components/ai/node.tsx",
      "packages/ui/src/components/ai/open-in-chat.tsx",
      "packages/ui/src/components/ai/package-info.tsx",
      "packages/ui/src/components/ai/panel.tsx",
      "packages/ui/src/components/ai/persona.tsx",
      "packages/ui/src/components/ai/plan.tsx",
      "packages/ui/src/components/ai/prompt-input.tsx",
      "packages/ui/src/components/ai/queue.tsx",
      "packages/ui/src/components/ai/reasoning.tsx",
      "packages/ui/src/components/ai/sandbox.tsx",
      "packages/ui/src/components/ai/schema-display.tsx",
      "packages/ui/src/components/ai/shimmer.tsx",
      "packages/ui/src/components/ai/snippet.tsx",
      "packages/ui/src/components/ai/sources.tsx",
      "packages/ui/src/components/ai/speech-input.tsx",
      "packages/ui/src/components/ai/stack-trace.tsx",
      "packages/ui/src/components/ai/suggestion.tsx",
      "packages/ui/src/components/ai/task.tsx",
      "packages/ui/src/components/ai/terminal.tsx",
      "packages/ui/src/components/ai/test-results.tsx",
      "packages/ui/src/components/ai/tool.tsx",
      "packages/ui/src/components/ai/toolbar.tsx",
      "packages/ui/src/components/ai/transcription.tsx",
      "packages/ui/src/components/ai/voice-selector.tsx",
      "packages/ui/src/components/ai/web-preview.tsx",
    ],
  },
  {
    id: "settings-components",
    title: "Settings Components",
    group: "components",
    description: "설정 섹션, 행, 상태 배지, 아바타.",
    sourcePaths: ["packages/ui/src/settings/index.ts", "apps/app/src/pages/settings/"],
  },
  {
    id: "page-shell",
    title: "Page Shell",
    group: "patterns",
    description: "브레드크럼, 상단 액션, 서브바, 콘텐츠가 결합된 페이지 골격.",
    sourcePaths: ["packages/ui/src/components/page-layout.tsx"],
  },
  {
    id: "entity-page",
    title: "Entity Page",
    group: "patterns",
    description: "목록 우선 엔티티 화면의 실제 배치.",
    sourcePaths: [
      "apps/app/src/features/story/pages/entity-list-view.tsx",
      "packages/ui/src/components/entity-table.tsx",
      "packages/ui/src/components/entity-subbar.tsx",
      "packages/ui/src/components/list-view-setting-popover.tsx",
    ],
  },
  {
    id: "detail-page",
    title: "Detail Page",
    group: "patterns",
    description: "상세 화면의 공통 topbar, editor card, 우측 meta rail 구조.",
    sourcePaths: [
      "apps/app/src/features/story/layouts/detail-page-shell.tsx",
      "apps/app/src/features/story/pages/entity-detail-page.tsx",
    ],
  },
];

export const DEFAULT_DESIGN_SYSTEM_SECTION_ID = "colors";

export function getDesignSystemSection(sectionId: string): DesignSystemSection {
  return (
    DESIGN_SYSTEM_SECTIONS.find((section) => section.id === sectionId) ?? DESIGN_SYSTEM_SECTIONS[0]
  );
}

export function groupDesignSystemSections(): Array<{
  group: DesignSystemGroup;
  sections: DesignSystemSection[];
}> {
  return DESIGN_SYSTEM_GROUPS.map((group) => ({
    group,
    sections: DESIGN_SYSTEM_SECTIONS.filter((section) => section.group === group.id),
  }));
}
