import { useAtom } from "jotai";
import { atomFamily, atomWithStorage } from "jotai/utils";

export interface StoryListViewSettings {
  grouping: string;
  ordering: string;
  recent: string;
  showSubItems: boolean;
  visiblePropertyIds: string[];
}

export interface StoryListViewSettingsDefaults {
  grouping: string;
  ordering: string;
  recent?: string;
  showSubItems?: boolean;
  visiblePropertyIds: string[];
}

const STORAGE_PREFIX = "product-builder:story:list-view-settings:";

const settingsAtomFamily = atomFamily((settingsId: string) =>
  atomWithStorage<Partial<StoryListViewSettings>>(`${STORAGE_PREFIX}${settingsId}`, {}),
);

export function useStoryListViewSettings(
  settingsId: string,
  defaults: StoryListViewSettingsDefaults,
) {
  const [stored, setStored] = useAtom(settingsAtomFamily(settingsId));
  const validVisibleIds = new Set(defaults.visiblePropertyIds);
  const visiblePropertyIds = (stored.visiblePropertyIds ?? defaults.visiblePropertyIds).filter(
    (id) => validVisibleIds.has(id),
  );

  const settings: StoryListViewSettings = {
    grouping: stored.grouping ?? defaults.grouping,
    ordering: stored.ordering ?? defaults.ordering,
    recent: stored.recent ?? defaults.recent ?? "all",
    showSubItems: stored.showSubItems ?? defaults.showSubItems ?? true,
    visiblePropertyIds:
      visiblePropertyIds.length > 0 ? visiblePropertyIds : defaults.visiblePropertyIds,
  };

  return {
    settings,
    setGrouping: (grouping: string) => setStored((current) => ({ ...current, grouping })),
    setOrdering: (ordering: string) => setStored((current) => ({ ...current, ordering })),
    setRecent: (recent: string) => setStored((current) => ({ ...current, recent })),
    setShowSubItems: (showSubItems: boolean) =>
      setStored((current) => ({ ...current, showSubItems })),
    setVisiblePropertyIds: (visiblePropertyIds: string[]) =>
      setStored((current) => ({
        ...current,
        visiblePropertyIds: visiblePropertyIds.filter((id) => validVisibleIds.has(id)),
      })),
  };
}
