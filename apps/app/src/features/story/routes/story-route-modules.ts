export type StoryRouteModuleKey =
  | "characterList"
  | "chatPage"
  | "codexList"
  | "draft"
  | "factionList"
  | "locationList"
  | "projectSearch"
  | "projectSettings"
  | "worldList";

export const loadAppShell = () => import("../layouts/app-shell");
export const loadCharacterListPage = () => import("../pages/character-list-page");
export const loadCodexListPage = () => import("../pages/codex-list-page");
export const loadDraftPage = () => import("../pages/draft-page");
export const loadFactionListPage = () => import("../pages/faction-list-page");
export const loadLocationListPage = () => import("../pages/location-list-page");
export const loadProjectSearchPage = () => import("../pages/project-search-page");
export const loadProjectSettingsPage = () => import("../pages/project-settings-page");
export const loadChatPage = () => import("../pages/chat-page");
export const loadWorldListPage = () => import("../pages/world-list-page");

const storyRouteModuleLoaders: Record<StoryRouteModuleKey, () => Promise<unknown>> = {
  characterList: loadCharacterListPage,
  chatPage: loadChatPage,
  codexList: loadCodexListPage,
  draft: loadDraftPage,
  factionList: loadFactionListPage,
  locationList: loadLocationListPage,
  projectSearch: loadProjectSearchPage,
  projectSettings: loadProjectSettingsPage,
  worldList: loadWorldListPage,
};

const storyRouteModuleMatchers: [RegExp, StoryRouteModuleKey][] = [
  [/^$/, "worldList"],
  [/^lore$/, "worldList"],
  [/^lore\/characters\/.+/, "characterList"],
  [/^lore\/characters$/, "characterList"],
  [/^lore\/locations\/.+/, "locationList"],
  [/^lore\/locations$/, "locationList"],
  [/^lore\/factions\/.+/, "factionList"],
  [/^lore\/factions$/, "factionList"],
  [/^lore\/codex\/.+/, "codexList"],
  [/^lore\/codex$/, "codexList"],
  [/^lore\/worlds\/.+/, "worldList"],
  [/^drafts(?:\/.*)?$/, "draft"],
  [/^search$/, "projectSearch"],
  [/^chat(?:\/.*)?$/, "chatPage"],
  [/^settings$/, "projectSettings"],
];

export function getStoryRouteModuleKeys(pathname: string): StoryRouteModuleKey[] {
  const cleanPathname = pathname.split(/[?#]/, 1)[0] ?? pathname;
  const match = cleanPathname.match(/^\/p\/[^/]+(?:\/(.*))?$/);
  const childPath = match?.[1]?.replace(/\/+$/, "") ?? "";

  if (!match) return [];

  const routeModule = storyRouteModuleMatchers.find(([pattern]) => pattern.test(childPath))?.[1];
  return routeModule ? [routeModule] : [];
}

export function preloadStoryRouteModules(pathname: string): Promise<void> {
  const keys = getStoryRouteModuleKeys(pathname);
  return Promise.all(keys.map((key) => storyRouteModuleLoaders[key]())).then(() => undefined);
}
