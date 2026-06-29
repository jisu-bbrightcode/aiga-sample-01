/**
 * Story Domain Registry — 5개 lore 도메인 (worlds/characters/locations/factions/codex)
 * metadata 한 곳에서 관리.
 *
 * Hook factory (useDomainCRUD / useDomainCreate / useDomainUpdate / useDomainDelete)
 * 는 `use-story-mutations.ts` 에 위치 — circular import 회피.
 */

export const STORY_DOMAIN_KEYS = [
  "worlds",
  "characters",
  "locations",
  "factions",
  "codex",
] as const;

export type StoryDomainKey = (typeof STORY_DOMAIN_KEYS)[number];

export interface DomainMeta {
  key: StoryDomainKey;
  /** 도메인 한글 단수 (모달 라벨, "+ 새 X 만들기") */
  label: string;
  /** 사이드바 표시 텍스트 */
  sidebarLabel: string;
  /** /p/{pid}/lore/<routeSegment> — worlds 는 빈 문자열 (lore 루트) */
  routeSegment: string;
}

export const STORY_DOMAINS: Record<StoryDomainKey, DomainMeta> = {
  worlds: {
    key: "worlds",
    label: "세계",
    sidebarLabel: "세계",
    routeSegment: "",
  },
  characters: {
    key: "characters",
    label: "캐릭터",
    sidebarLabel: "캐릭터",
    routeSegment: "characters",
  },
  locations: {
    key: "locations",
    label: "장소",
    sidebarLabel: "장소",
    routeSegment: "locations",
  },
  factions: {
    key: "factions",
    label: "세력",
    sidebarLabel: "세력",
    routeSegment: "factions",
  },
  codex: {
    key: "codex",
    label: "코덱스",
    sidebarLabel: "코덱스",
    routeSegment: "codex",
  },
};
