// Product Design Components — PX 디자이너가 만드는 순수 UI 컴포넌트
// API 호출, 라우팅, 상태 관리 없음. props로 데이터를 받아 렌더링만.
//
// 사용: import { LoreCard } from "@repo/ui/components"

export { AppShellWrapper } from "./app-shell-wrapper";
// ─── App Shell ────────────────────────────────────────────────
export { AppSidebar } from "./app-sidebar";
// ─── Auth ─────────────────────────────────────────────────────
export { AuthForm } from "./auth/auth-form";
// ─── Detail ───────────────────────────────────────────────────
export { DetailHeader } from "./detail/detail-header";
export { PropertyTable } from "./detail/property-table";
export { RelationList } from "./detail/relation-list";
export { DetailPageWrapper } from "./detail-page-wrapper";
export {
  IconMultiToggleGroup,
  IconToggleButton,
  IconToggleGroup,
  type IconToggleOption,
} from "./icon-toggle";
export {
  type ListViewSettingOption,
  ListViewSettingPopover,
  type ListViewSettingPopoverLabels,
  type ListViewSettingProperty,
} from "./list-view-setting-popover";
// ─── Lore ─────────────────────────────────────────────────────
export { LoreCard } from "./lore/lore-card";
export { LoreFilterTabs } from "./lore/lore-filter-tabs";
// ─── Onboarding ───────────────────────────────────────────────
export { OnboardingStep } from "./onboarding/onboarding-step";
export type { EntityType } from "./primitives";
// ─── Primitives (re-export) ───────────────────────────────────
export {
  EmptyState,
  EntityBadge,
  MetaDot,
  SearchInput,
  SectionTitle,
  StatBar,
  TypeIcon,
} from "./primitives";
// ─── Project ──────────────────────────────────────────────────
export { ProjectCard } from "./project/project-card";
export {
  ArrowLeftIcon,
  DetailActivityItem,
  DetailAddButton,
  DetailEditorToolbar,
  DetailGraphMini,
  DetailMention,
  DetailMetaItem,
  DetailPropRow,
  DetailRelationRow,
  MetaSectionTitle,
  MoreHorizontalIcon,
  StandardDetailLayout,
  ToolbarIconButton,
} from "./standard-detail-layout";
