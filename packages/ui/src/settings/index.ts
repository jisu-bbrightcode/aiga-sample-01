/**
 * Settings shared components — Phase 0b.10 barrel.
 *
 * Consumers import via `@repo/ui/settings/<Name>` (per package.json
 * `./settings/*` export). Each component is independently importable.
 */
export { DataTable, type DataTableGroup } from "./DataTable";
export { EmptyComingSoon } from "./EmptyComingSoon";
export { HueAvatar } from "./HueAvatar";
export { ProjectIcon } from "./ProjectIcon";
export { Pill } from "./Pill";
export { SetConfirmDialog } from "./SetConfirmDialog";
export { SetDangerZone } from "./SetDangerZone";
export { SetField } from "./SetField";
export { SetListRow } from "./SetListRow";
export { SetPrefixInput } from "./SetPrefixInput";
export { SetSection } from "./SetSection";
export { SetTable, type SetTableColumn } from "./SetTable";
export { SettingItem } from "./SettingItem";
export {
  SettingsSidebarNav,
  settingsSidebarItemClassName,
  type SettingsSidebarNavGroup,
  type SettingsSidebarNavItem,
} from "./SettingsSidebarNav";
