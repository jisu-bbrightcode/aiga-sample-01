/**
 * Story tree item row: 32px height, chevron+icon+label+count+badge.
 * Design CSS: .story-tree-item — flex, gap 8px, 2px 8px padding, radius-lg(8px),
 *   margin 1px 2px, bg surface. Hover: surface-hover. Selected: surface-hover.
 * Indent: depth 0=0px, 1=20px, 2=44px.
 * Icon: 14x14, 4px radius.
 * Chevron: 16x16 container, 12px icon, rotate 90 when open.
 */

import { useFeatureTranslation } from "@repo/core/i18n";
import { cn } from "@repo/ui/lib/utils";
import { ChevronRight } from "lucide-react";
import { StoryTreeBadge } from "./story-tree-badge";

interface Props {
  id: string;
  label: string;
  depth?: number;
  iconColor?: string;
  relationCount?: number;
  badge?: { label: string; variant: "done" | "draft" | "branch" };
  isExpanded?: boolean;
  hasChildren?: boolean;
  isChapter?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  onToggle?: () => void;
  dataEl?: string;
}

export function StoryTreeItem({
  label,
  depth = 0,
  iconColor,
  relationCount,
  badge,
  isExpanded = false,
  hasChildren = false,
  isChapter = false,
  isSelected = false,
  onClick,
  onToggle,
  dataEl,
}: Props) {
  const { t } = useFeatureTranslation("feature.story");
  const indentWidth = INDENT_MAP[depth] ?? depth * 20;

  return (
    <div
      data-el={dataEl}
      className={cn(
        "group relative flex h-8 cursor-default items-center gap-sm rounded-lg",
        "mx-2xs my-[1px] bg-card px-sm py-2xs text-base",
        "transition-colors duration-75",
        "hover:bg-muted hover:text-foreground",
        isSelected && "bg-accent",
      )}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick?.();
      }}
      role="treeitem"
      tabIndex={0}
      aria-expanded={hasChildren ? isExpanded : undefined}
      aria-selected={isSelected}
    >
      {/* Indent */}
      <div className="shrink-0" style={{ width: `${indentWidth}px` }} />

      {/* Chevron */}
      <div
        className={cn(
          "flex size-4 shrink-0 items-center justify-center text-muted-foreground",
          "transition-transform duration-150",
          isExpanded && "rotate-90",
          !hasChildren && "invisible",
        )}
        onClick={(e) => {
          e.stopPropagation();
          onToggle?.();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.stopPropagation();
            onToggle?.();
          }
        }}
        role={hasChildren ? "button" : undefined}
        tabIndex={hasChildren ? 0 : undefined}
        aria-label={hasChildren ? (isExpanded ? t("storyTree.item.collapse") : t("storyTree.item.expand")) : undefined}
      >
        <ChevronRight className="size-3.5" />
      </div>

      {/* Icon — 14x14 색 채운 사각형 (border-radius 4px) */}
      <div className={cn("size-3.5 shrink-0 rounded-[4px]", iconColor)} />

      {/* Label */}
      <div
        className={cn(
          "min-w-0 flex-1 truncate",
          isChapter ? "font-semibold text-foreground" : "text-muted-foreground",
          isSelected && "text-foreground",
        )}
      >
        {label}
      </div>

      {/* Relation count — 항상 표시하여 컬럼 정렬 유지 */}
      <span className="mr-md shrink-0 text-base text-muted-foreground">
        {t("storyTree.item.relationCount", { count: relationCount ?? 0 })}
      </span>

      {/* Badge */}
      {badge ? <StoryTreeBadge variant={badge.variant} label={badge.label} /> : null}
    </div>
  );
}

/* Constants */

const INDENT_MAP: Record<number, number> = {
  0: 0,
  1: 20,
  2: 44,
};
