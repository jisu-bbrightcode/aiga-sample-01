/**
 * Draft list row: 32px height, no chevron/indent (unlike StoryTreeItem).
 * Structure: [gray square 14x14] [title (flex:1)] [relative time (right)]
 * Design CSS: .story-tree-item — height 32px, gap 8px, padding 2px 8px,
 * border-radius 8px, font-size 13px. Selected: bg surface-hover.
 */

import { useFeatureTranslation } from "@repo/core/i18n";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/shadcn/button";

type TFn = (key: string, options?: Record<string, unknown>) => string;

interface Props {
  id: string;
  title: string;
  updatedAt?: string | Date | null;
  isSelected?: boolean;
  onClick?: () => void;
  dataEl?: string;
}

export function DraftListItem({ title, updatedAt, isSelected, onClick, dataEl }: Props) {
  const { t } = useFeatureTranslation("feature.story");
  return (
    <Button
      variant="ghost"
      data-el={dataEl}
      onClick={onClick}
      className={cn(
        "mx-2xs flex h-8 w-[calc(100%-theme(spacing.xs))] items-center gap-sm rounded-lg px-sm",
        "text-base transition-colors duration-75",
        isSelected ? "bg-accent/10 text-foreground" : "text-muted-foreground hover:bg-muted",
      )}
    >
      {/* Icon placeholder — gray square 14x14 */}
      <div className="size-3.5 shrink-0 rounded bg-muted-foreground/40" />

      {/* Title */}
      <span
        className={cn(
          "flex-1 truncate text-left",
          isSelected ? "text-foreground" : "text-secondary-foreground",
        )}
      >
        {title}
      </span>

      {/* Relative time */}
      {updatedAt ? (
        <span className="shrink-0 text-base text-muted-foreground">
          {formatRelativeTime(updatedAt, t)}
        </span>
      ) : null}
    </Button>
  );
}

/* Helpers */

function formatRelativeTime(date: string | Date | null, t: TFn): string {
  if (!date) return "";
  const now = Date.now();
  const d = typeof date === "string" ? new Date(date).getTime() : date.getTime();
  const diff = now - d;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  const weeks = Math.floor(days / 7);

  if (minutes < 1) return t("draft.listItem.justNow");
  if (minutes < 60) return t("draft.listItem.minutesAgo", { count: minutes });
  if (hours < 24) return t("draft.listItem.hoursAgo", { count: hours });
  if (days === 1) return t("draft.listItem.yesterday");
  if (days < 7) return t("draft.listItem.daysAgo", { count: days });
  if (weeks < 5) return t("draft.listItem.weeksAgo", { count: weeks });
  return new Date(d).toLocaleDateString("ko-KR");
}
