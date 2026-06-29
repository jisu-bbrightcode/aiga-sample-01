/**
 * Entity list 공통 서브바 — status tabs + 우측 액션(view tabs/query tools).
 * 뷰 전환/정렬/설정 등 구체 기능은 prop 주입으로 확장 가능한 slot.
 */

import {
  Calendar,
  GalleryVerticalEnd,
  LayoutGrid,
  List,
  Network,
  SlidersHorizontal,
  SortAsc,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { Button } from "../_shadcn/button";
import { cn } from "../lib/utils";
import { IconToggleGroup, type IconToggleOption } from "./icon-toggle";

export interface StatusTab<V extends string = string> {
  value: V;
  label: string;
}

export type ViewMode = "list" | "board" | "timeline" | "calendar" | "canvas";

const DEFAULT_VIEW_TABS: Array<{
  id: ViewMode;
  label: string;
  Icon: ComponentType<{ className?: string }>;
}> = [
  { id: "list", label: "목록", Icon: List },
  { id: "board", label: "보드", Icon: LayoutGrid },
  { id: "timeline", label: "타임라인", Icon: GalleryVerticalEnd },
  { id: "calendar", label: "캘린더", Icon: Calendar },
  { id: "canvas", label: "캔버스", Icon: Network },
];

const VIEW_TAB_BY_ID = new Map(DEFAULT_VIEW_TABS.map((tab) => [tab.id, tab]));

interface EntitySubbarProps<V extends string> {
  statusTabs: StatusTab<V>[];
  status: V;
  onStatusChange: (value: V) => void;
  count?: number;
  /** 뷰 모드 — 기본 5개(list/board/timeline/calendar/canvas) 노출. false 는 숨김. */
  viewMode?: ViewMode | null;
  onViewModeChange?: (mode: ViewMode | null) => void;
  viewTabs?: readonly ViewMode[] | false;
  allowViewModeOff?: boolean;
  /** 우측 커스텀 슬롯 (예외: AI batch 등). rightSlot 주어지면 view-tabs/qtool 무시. */
  rightSlot?: ReactNode;
  /** 정렬/설정 query tool 기본 버튼 노출. rightSlot 이 주어지면 무시. */
  onSort?: () => void;
  onSettings?: () => void;
  /** 설정 버튼 자리에 렌더링할 실제 popover/slot. */
  settingsSlot?: ReactNode;
}

export function EntitySubbar<V extends string>({
  statusTabs,
  status,
  onStatusChange,
  count,
  viewMode = "list",
  onViewModeChange,
  viewTabs,
  allowViewModeOff = false,
  rightSlot,
  onSort,
  onSettings,
  settingsSlot,
}: EntitySubbarProps<V>) {
  const visibleViewTabs =
    viewTabs === false
      ? []
      : (viewTabs ?? DEFAULT_VIEW_TABS.map((tab) => tab.id))
          .map((id) => VIEW_TAB_BY_ID.get(id))
          .filter((tab): tab is (typeof DEFAULT_VIEW_TABS)[number] => Boolean(tab));

  return (
    <div
      data-el="entity-subbar"
      // 사용자 피드백: 컨텐츠 영역이 답답해 보여 56 으로 키움.
      className="flex h-11 shrink-0 flex-wrap items-center gap-4 px-7 pt-1.5 pb-3.5"
    >
      {/* Status tabs */}
      <div className="flex items-center gap-0.5" data-el="status-tabs">
        {statusTabs.map((t) => (
          <Button
            key={t.value}
            type="button"
            variant="ghost"
            onClick={() => onStatusChange(t.value)}
            className={cn(
              "h-7 rounded-md px-3 text-base font-medium transition-colors",
              status === t.value
                ? "bg-[rgba(31,29,24,0.06)] text-sidebar-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {typeof count === "number" ? (
        <span className="text-xs tabular-nums text-muted-foreground">{count}개</span>
      ) : null}

      <div className="ml-auto flex items-center gap-2" data-el="entity-subbar.right">
        {rightSlot ?? (
          <>
            {visibleViewTabs.length > 0 ? (
              <IconToggleGroup<ViewMode>
                options={
                  visibleViewTabs.map(({ id, label, Icon }) => ({
                    id,
                    label,
                    icon: <Icon className="size-3.5" />,
                  })) as IconToggleOption<ViewMode>[]
                }
                value={viewMode}
                allowOff={allowViewModeOff}
                onValueChange={(next) => onViewModeChange?.(next)}
              />
            ) : null}

            {/* divider */}
            {(onSort || onSettings || settingsSlot) && (
              <span className="h-4 w-px bg-[rgba(31,29,24,0.1)]" aria-hidden />
            )}

            <div className="flex items-center gap-0.5" data-el="query-tools">
              {onSort ? (
                <QueryToolButton onClick={onSort} title="정렬">
                  <SortAsc className="size-3.5" />
                </QueryToolButton>
              ) : null}
              {settingsSlot}
              {!settingsSlot && onSettings ? (
                <QueryToolButton onClick={onSettings} title="설정">
                  {/* 디자인: 두 줄 슬라이더 + 노브 — lucide SlidersHorizontal */}
                  <SlidersHorizontal className="size-3.5" />
                </QueryToolButton>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function QueryToolButton({
  children,
  onClick,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="grid h-7 w-7 place-items-center rounded-md p-0 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {children}
    </Button>
  );
}
