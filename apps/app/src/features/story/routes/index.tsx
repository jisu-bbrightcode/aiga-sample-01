/**
 * Story Feature Routes
 *
 * /p/$projectId              → WorkspacePage (layout with sidebar + Outlet)
 * /p/$projectId/lore         → WorldListPage
 * /p/$projectId/lore/worlds/$entityId → WorldListPage (split detail)
 * /p/$projectId/lore/characters/$entityId → CharacterListPage (split detail)
 * /p/$projectId/lore/locations/$entityId → LocationListPage (split detail)
 * /p/$projectId/lore/factions/$entityId → FactionListPage (split detail)
 * /p/$projectId/lore/codex   → CodexListPage
 * /p/$projectId/lore/codex/$entityId → CodexListPage (split detail)
 * /p/$projectId/drafts       → DraftPage (list + editor split view)
 * /p/$projectId/drafts/$draftId → DraftPage (with selected draft)
 * /p/$projectId/search       → ProjectSearchPage (all project content search)
 */

import type { AnyRoute } from "@tanstack/react-router";
import { createRoute } from "@tanstack/react-router";
import { type ComponentType, lazy, Suspense } from "react";
import { createLocalizationRoutes } from "@/features/localization/routes";
import { WorkspacePage } from "../pages/workspace-page";
import {
  loadCharacterListPage,
  loadChatPage,
  loadCodexListPage,
  loadDraftPage,
  loadFactionListPage,
  loadLocationListPage,
  loadProjectSearchPage,
  loadProjectSettingsPage,
  loadWorldListPage,
} from "./story-route-modules";

// 무거운 페이지는 lazy + Suspense — 프로젝트 진입 cold start 단축.
// Vite/Rollup 이 dynamic import 를 청크로 분할.
// defaultPreload="intent" (router.tsx) 가 hover 시 미리 로드해 사용성 유지.
const CharacterListPage = lazy(() =>
  loadCharacterListPage().then((m) => ({ default: m.CharacterListPage })),
);
const CodexListPage = lazy(() => loadCodexListPage().then((m) => ({ default: m.CodexListPage })));
const DraftPage = lazy(() => loadDraftPage().then((m) => ({ default: m.DraftPage })));
const FactionListPage = lazy(() =>
  loadFactionListPage().then((m) => ({ default: m.FactionListPage })),
);
const LocationListPage = lazy(() =>
  loadLocationListPage().then((m) => ({ default: m.LocationListPage })),
);
const ProjectSettingsPage = lazy(() =>
  loadProjectSettingsPage().then((m) => ({ default: m.ProjectSettingsPage })),
);
const ProjectSearchPage = lazy(() =>
  loadProjectSearchPage().then((m) => ({ default: m.ProjectSearchPage })),
);
const ChatPage = lazy(() => loadChatPage().then((m) => ({ default: m.ChatPage })));
const WorldListPage = lazy(() => loadWorldListPage().then((m) => ({ default: m.WorldListPage })));

function PageFallback() {
  return null;
}

function withSuspense<P extends object>(Cmp: ComponentType<P>) {
  return (props: P) => (
    <Suspense fallback={<PageFallback />}>
      <Cmp {...props} />
    </Suspense>
  );
}

const CharacterListPageS = withSuspense(CharacterListPage);
const CodexListPageS = withSuspense(CodexListPage);
const DraftPageS = withSuspense(DraftPage);
const FactionListPageS = withSuspense(FactionListPage);
const LocationListPageS = withSuspense(LocationListPage);
const ProjectSettingsPageS = withSuspense(ProjectSettingsPage);
const ProjectSearchPageS = withSuspense(ProjectSearchPage);
const ChatPageS = withSuspense(ChatPage);
const WorldListPageS = withSuspense(WorldListPage);

export function createStoryRoutes<T extends AnyRoute>(parentRoute: T) {
  // Workspace layout with sidebar
  const workspaceRoute = createRoute({
    getParentRoute: () => parentRoute,
    path: "/p/$projectId",
    component: WorkspacePage,
  });

  // Lore list (all entities)
  const loreRoute = createRoute({
    getParentRoute: () => workspaceRoute,
    path: "/lore",
    component: WorldListPageS,
  });

  // Entity list routes
  const characterListRoute = createRoute({
    getParentRoute: () => workspaceRoute,
    path: "/lore/characters",
    component: CharacterListPageS,
  });

  const locationListRoute = createRoute({
    getParentRoute: () => workspaceRoute,
    path: "/lore/locations",
    component: LocationListPageS,
  });

  const factionListRoute = createRoute({
    getParentRoute: () => workspaceRoute,
    path: "/lore/factions",
    component: FactionListPageS,
  });

  const codexListRoute = createRoute({
    getParentRoute: () => workspaceRoute,
    path: "/lore/codex",
    component: CodexListPageS,
  });

  // Entity detail routes
  const worldDetailRoute = createRoute({
    getParentRoute: () => workspaceRoute,
    path: "/lore/worlds/$entityId",
    component: WorldListPageS,
  });

  const characterDetailRoute = createRoute({
    getParentRoute: () => workspaceRoute,
    path: "/lore/characters/$entityId",
    component: CharacterListPageS,
  });

  const locationDetailRoute = createRoute({
    getParentRoute: () => workspaceRoute,
    path: "/lore/locations/$entityId",
    component: LocationListPageS,
  });

  const factionDetailRoute = createRoute({
    getParentRoute: () => workspaceRoute,
    path: "/lore/factions/$entityId",
    component: FactionListPageS,
  });

  const codexDetailRoute = createRoute({
    getParentRoute: () => workspaceRoute,
    path: "/lore/codex/$entityId",
    component: CodexListPageS,
  });

  // Draft routes
  const draftsRoute = createRoute({
    getParentRoute: () => workspaceRoute,
    path: "/drafts",
    component: DraftPageS,
  });

  const draftDetailRoute = createRoute({
    getParentRoute: () => workspaceRoute,
    path: "/drafts/$draftId",
    component: DraftPageS,
  });

  const projectSearchRoute = createRoute({
    getParentRoute: () => workspaceRoute,
    path: "/search",
    component: ProjectSearchPageS,
  });

  const chatRoute = createRoute({
    getParentRoute: () => workspaceRoute,
    path: "/chat",
    component: ChatPageS,
  });

  const chatCharacterRoute = createRoute({
    getParentRoute: () => workspaceRoute,
    path: "/chat/$characterId",
    component: ChatPageS,
  });

  // Settings — separate from workspace (no sidebar)
  const settingsRoute = createRoute({
    getParentRoute: () => parentRoute,
    path: "/p/$projectId/settings",
    component: ProjectSettingsPageS,
  });

  // Localization routes (from localization feature)
  const locRoutes = createLocalizationRoutes(workspaceRoute);

  return [
    workspaceRoute.addChildren([
      loreRoute,
      characterListRoute,
      locationListRoute,
      factionListRoute,
      codexListRoute,
      worldDetailRoute,
      characterDetailRoute,
      locationDetailRoute,
      factionDetailRoute,
      codexDetailRoute,
      draftsRoute,
      draftDetailRoute,
      projectSearchRoute,
      chatRoute,
      chatCharacterRoute,
      ...locRoutes,
    ]),
    settingsRoute,
  ] as const;
}
