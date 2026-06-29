/**
 * Story Feature — Client Entry Point
 */

// Components
export { CreateEntityDialog } from "./components/create-entity-dialog";
export { PropertyTable } from "./components/property-table";
export { RelationList } from "./components/relation-list";
export { StoryTreeBadge } from "./components/story-tree-badge";
export { StoryTreeItem } from "./components/story-tree-item";
// Hooks (mutations)
export {
  useAddEntityTag,
  useCreateCharacter,
  useCreateCodexEntry,
  useCreateDraft,
  useCreateFaction,
  useCreateLocation,
  useCreateRelation,
  useCreateTag,
  useCreateWorld,
  useDeleteCharacter,
  useDeleteCodexEntry,
  useDeleteDraft,
  useDeleteFaction,
  useDeleteLocation,
  useDeleteRelation,
  useDeleteTag,
  useDeleteWorld,
  useRemoveEntityTag,
  useUpdateCharacter,
  useUpdateCodexEntry,
  useUpdateDraft,
  useUpdateFaction,
  useUpdateLocation,
  useUpdateWorld,
} from "@repo/data/hooks";
// Hooks (queries)
export {
  useCharacter,
  useCharacters,
  useCodexEntries,
  useCodexEntry,
  useDraft,
  useDrafts,
  useEntityTags,
  useFaction,
  useFactions,
  useLocation,
  useLocations,
  useRelations,
  useTags,
  useWorld,
  useWorlds,
} from "@repo/data/hooks";
// Layouts
export { AppShell } from "./layouts/app-shell";
export { ContentsToolbar } from "./layouts/contents-toolbar";
export { DetailLayout, MetaSection } from "./layouts/detail-layout";
export { DetailToolbar } from "./layouts/detail-toolbar";
export { EntityTag, getEntityTagVariant } from "./layouts/entity-tag";
export { MemoCard } from "./layouts/memo-card";
export { PaperCard } from "./layouts/paper-card";
export { StoryEmptyState } from "./layouts/story-empty-state";
export { CharacterListPage } from "./pages/character-list-page";
export { DraftPage } from "./pages/draft-page";
export { EntityDetailPage } from "./pages/entity-detail-page";
export { FactionListPage } from "./pages/faction-list-page";
export { LocationListPage } from "./pages/location-list-page";
// Pages
export { WorkspacePage } from "./pages/workspace-page";
export { WorldListPage } from "./pages/world-list-page";
export { createStoryRoutes } from "./routes/index";
