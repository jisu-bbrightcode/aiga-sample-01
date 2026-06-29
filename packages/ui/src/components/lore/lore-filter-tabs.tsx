/**
 * 세계관 목록 필터 탭. 전체/세계/캐릭터/장소/세력/코덱스.
 * TypeIcon + 한글 라벨 + 선택적 카운트 뱃지.
 */

import { cn } from "@repo/ui/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import type { EntityType } from "../primitives";
import { TypeIcon } from "../primitives";

interface Props {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  counts?: Record<string, number>;
  className?: string;
}

const TABS: { id: string; label: string; type?: EntityType }[] = [
  { id: "all", label: "전체" },
  { id: "world", label: "세계", type: "world" },
  { id: "character", label: "캐릭터", type: "character" },
  { id: "location", label: "장소", type: "location" },
  { id: "faction", label: "세력", type: "faction" },
  { id: "codex", label: "코덱스", type: "codex" },
];

export function LoreFilterTabs({ activeTab = "all", onTabChange, counts, className }: Props) {
  return (
    <Tabs
      value={activeTab}
      onValueChange={onTabChange}
      className={cn(className)}
      data-testid="lore-filter-tabs"
    >
      <TabsList className="h-auto gap-1 bg-transparent p-0">
        {TABS.map((tab) => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            className="gap-1.5 rounded-md px-3 py-1.5 text-sm data-[state=active]:bg-accent data-[state=active]:shadow-none"
            data-testid={`lore-filter-tab-${tab.id}`}
          >
            {tab.type && <TypeIcon type={tab.type} size={14} className="shrink-0" />}
            <span>{tab.label}</span>
            {counts?.[tab.id] !== undefined && (
              <span className="text-xs text-muted-foreground">{counts[tab.id]}</span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
