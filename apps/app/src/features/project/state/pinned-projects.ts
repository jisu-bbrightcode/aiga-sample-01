/**
 * Pinned project ids — persisted to localStorage so the user's "starred"
 * selection survives reloads. JSON-serializable string[] (Sets aren't).
 *
 * Used by:
 *  - ProjectCard pin toggle (favorite star)
 *  - Sidebar "즐겨찾기" filter
 *  - Subbar scope "즐겨찾기" tab
 *  - Sort: pinned cards float to the top
 */

import { atom, useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";

const STORAGE_KEY = "product-builder:pinned-projects";

export const pinnedProjectIdsAtom = atomWithStorage<string[]>(STORAGE_KEY, []);

export const pinnedSetAtom = atom((get) => new Set(get(pinnedProjectIdsAtom)));

export function usePinnedProjects() {
  const [ids, setIds] = useAtom(pinnedProjectIdsAtom);
  const set = new Set(ids);
  return {
    ids,
    has: (id: string) => set.has(id),
    toggle: (id: string) =>
      setIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
      ),
  };
}
