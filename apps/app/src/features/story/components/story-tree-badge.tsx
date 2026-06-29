/**
 * Story tree badge: done/draft/branch variants.
 * Design CSS: .story-tree-badge — 13px, padding 1px 8px, rounded-full.
 */
import { useFeatureTranslation } from "@repo/core/i18n";
import { cn } from "@repo/ui/lib/utils";

interface Props {
  variant: "done" | "draft" | "branch";
  label?: string;
  className?: string;
}

export function StoryTreeBadge({ variant, label, className }: Props) {
  const { t } = useFeatureTranslation("feature.story");
  const displayLabel = label ?? t(VARIANT_LABEL_KEYS[variant]);

  return (
    <span
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full text-base",
        "px-sm py-2xs",
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      {displayLabel}
    </span>
  );
}

/* Constants */

const VARIANT_LABEL_KEYS: Record<Props["variant"], string> = {
  done: "storyTree.badge.done",
  draft: "storyTree.badge.draft",
  branch: "storyTree.badge.branch",
};

const VARIANT_CLASSES: Record<Props["variant"], string> = {
  done: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
  draft: "bg-muted text-muted-foreground",
  branch: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
};
