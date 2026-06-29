import { useFeatureTranslation } from "@repo/core/i18n";
import { cn } from "@repo/ui/lib/utils";
import { Input } from "@repo/ui/shadcn/input";
import { Search } from "lucide-react";
import type { ReactNode } from "react";

/* Main */

interface StorySplitDetailShellProps {
  rail: ReactNode;
  detail: ReactNode;
  className?: string;
  railWidth?: number;
  detailMinWidth?: number | string;
}

export function StorySplitDetailShell({
  rail,
  detail,
  className,
  railWidth,
  detailMinWidth,
}: StorySplitDetailShellProps) {
  const customRailWidth = typeof railWidth === "number";
  return (
    <div
      data-el="story-split"
      className={cn("relative flex h-screen min-h-0 overflow-hidden bg-background", className)}
    >
      <aside
        data-el="story-split.rail"
        className={cn(
          "flex min-h-0 shrink-0 flex-col bg-background pr-2",
          !customRailWidth && "w-[240px]",
        )}
        style={customRailWidth ? { width: railWidth } : undefined}
      >
        {rail}
      </aside>
      <main
        data-el="story-split.detail"
        className="min-w-0 flex-1"
        style={detailMinWidth === undefined ? undefined : { minWidth: detailMinWidth }}
      >
        {detail}
      </main>
    </div>
  );
}

/* Constants */

export const STORY_SPLIT_DEFAULT_RAIL_WIDTH = 240;

/* Subcomponents */

export function StorySplitRailSearch({ value, onChange, placeholder }: StorySplitRailSearchProps) {
  const { t } = useFeatureTranslation("feature.story");
  const resolvedPlaceholder = placeholder ?? t("shell.detail.searchPlaceholder");
  return (
    <div data-el="story-split.search" className="px-7 pb-2 pt-2">
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          aria-label={t("shell.detail.searchAria")}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={resolvedPlaceholder}
          className="h-7 border-transparent bg-transparent pl-7 pr-2 text-base shadow-none focus-visible:ring-1"
        />
      </div>
    </div>
  );
}

/* Types */

interface StorySplitRailSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}
