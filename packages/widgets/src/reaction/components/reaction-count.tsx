/**
 * ReactionCount Component
 *
 * Read-only reaction count display
 */
import { cn } from "@repo/ui/lib/utils";
import { Heart } from "lucide-react";
import type { ReactionCounts, ReactionType } from "../../common/types";

export interface ReactionCountProps {
  /** Reaction counts */
  counts: ReactionCounts;
  /** Show emojis */
  showEmojis?: boolean;
  /** Show icon */
  showIcon?: boolean;
  /** Additional classes */
  className?: string;
}

const REACTION_EMOJIS: Record<ReactionType, string> = {
  like: "\u{1F44D}",
  love: "\u2764\uFE0F",
  haha: "\u{1F602}",
  wow: "\u{1F62E}",
  sad: "\u{1F622}",
  angry: "\u{1F620}",
};

export function ReactionCount({
  counts,
  showEmojis = false,
  showIcon = true,
  className,
}: ReactionCountProps) {
  if (counts.total === 0) {
    return null;
  }

  return (
    <div className={cn("text-muted-foreground flex items-center gap-1 text-sm", className)}>
      {showEmojis && counts.byType.length > 0 ? (
        <>
          <div className="flex -space-x-1">
            {counts.byType.slice(0, 3).map(({ type }) => (
              <span key={type} className="text-base">
                {REACTION_EMOJIS[type]}
              </span>
            ))}
          </div>
          <span>{counts.total}</span>
        </>
      ) : (
        <>
          {showIcon && <Heart className="size-3.5" />}
          <span>{counts.total}</span>
        </>
      )}
    </div>
  );
}
