/**
 * Contents toolbar (Linear-style): 44px height, filter pill tabs + icon actions.
 * Design CSS: .contents-toolbar — flex, align-center, h 44px, padding 0 16px, gap 4px.
 * Filter tabs: .toolbar-tabs — pill group with rounded-full border, 2px padding.
 * Icon buttons: .toolbar-icon-btn — 28px, rounded-md, text-muted, hover surface-hover.
 */

import { useFeatureTranslation } from "@repo/core/i18n";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/shadcn/button";
import { ArrowUpDown, LayoutGrid, List, Plus, Search, SlidersHorizontal } from "lucide-react";

type ViewMode = "list" | "card";

interface Props {
  filters?: { label: string; value: string }[];
  activeFilter?: string;
  onFilterChange?: (value: string) => void;
  onAdd?: () => void;
  onSearch?: () => void;
  entityIcon?: React.ReactNode;
  entityLabel?: string;
  count?: number;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  children?: React.ReactNode;
  className?: string;
  dataEl?: string;
}

export function ContentsToolbar({
  filters,
  activeFilter,
  onFilterChange,
  onAdd,
  onSearch,
  entityIcon,
  entityLabel,
  count,
  viewMode,
  onViewModeChange,
  children,
  className,
  dataEl,
}: Props) {
  const { t } = useFeatureTranslation("feature.story");
  return (
    <div data-el={dataEl} className={cn("flex h-11 shrink-0 items-center gap-xs px-md", className)}>
      {/* Entity icon + label + count (contents-header variant) */}
      {entityIcon ? <span className="text-muted-foreground">{entityIcon}</span> : null}
      {entityLabel ? (
        <span className="text-base font-semibold text-foreground">{entityLabel}</span>
      ) : null}
      {count == null ? null : <span className="text-base text-muted-foreground">—</span>}

      {/* Filter tabs (pill group) */}
      {filters ? (
        <>
          <div className="flex items-center gap-0 rounded-full border border-border bg-card p-[2px]">
            {filters.map((f) => (
              <FilterTab
                key={f.value}
                label={f.label}
                active={activeFilter === f.value}
                onClick={() => onFilterChange?.(f.value)}
              />
            ))}
          </div>
          {onAdd ? (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground"
              onClick={onAdd}
              aria-label={t("shell.toolbar.addItem")}
              data-el={dataEl ? `${dataEl.replace("contents-header", "add-btn")}` : undefined}
            >
              <Plus className="size-3.5" />
            </Button>
          ) : null}
        </>
      ) : null}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right-side icon actions */}
      {onSearch ? (
        <ToolbarIconButton
          icon={<Search className="size-3.5" />}
          label={t("shell.toolbar.search")}
          onClick={onSearch}
        />
      ) : null}
      <ToolbarIconButton
        icon={<SlidersHorizontal className="size-3.5" />}
        label={t("shell.toolbar.filter")}
      />
      <ToolbarIconButton
        icon={<ArrowUpDown className="size-3.5" />}
        label={t("shell.toolbar.sort")}
      />
      {onViewModeChange ? (
        <ViewModeToggle
          viewMode={viewMode ?? "list"}
          onViewModeChange={onViewModeChange}
          dataEl={dataEl ? `${dataEl.replace("contents-header", "view-toggle")}` : undefined}
        />
      ) : (
        <ToolbarIconButton
          icon={<List className="size-3.5" />}
          label={t("shell.toolbar.viewToggle")}
        />
      )}

      {children}
    </div>
  );
}

/* Components */

interface FilterTabProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

function FilterTab({ label, active, onClick }: FilterTabProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={cn(
        "h-auto rounded-full px-sm py-xs text-base font-medium",
        "transition-colors duration-75",
        active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </Button>
  );
}

interface ToolbarIconButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}

function ToolbarIconButton({ icon, label, onClick }: ToolbarIconButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-7 text-muted-foreground hover:text-foreground"
      onClick={onClick}
      aria-label={label}
    >
      {icon}
    </Button>
  );
}

interface ViewModeToggleProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  dataEl?: string;
}

function ViewModeToggle({ viewMode, onViewModeChange, dataEl }: ViewModeToggleProps) {
  const { t } = useFeatureTranslation("feature.story");
  return (
    <div data-el={dataEl} className="flex gap-0.5 rounded-md bg-muted/50 p-0.5">
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "size-6 rounded-sm",
          viewMode === "list"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
        onClick={() => onViewModeChange("list")}
        aria-label={t("shell.toolbar.viewMode.list")}
      >
        <List className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "size-6 rounded-sm",
          viewMode === "card"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
        onClick={() => onViewModeChange("card")}
        aria-label={t("shell.toolbar.viewMode.card")}
      >
        <LayoutGrid className="size-3.5" />
      </Button>
    </div>
  );
}
