/**
 * ReactionBar Component
 *
 * Emoji reaction bar (multiple types selectable)
 */
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/shadcn/button";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/shadcn/popover";
import { SmilePlus } from "lucide-react";
import type { ReactionCounts, ReactionType } from "../../common/types";

export interface ReactionBarProps {
  /** Reaction counts by type */
  counts: ReactionCounts["byType"];
  /** User's selected reaction types */
  userTypes: ReactionType[];
  /** Reaction toggle handler */
  onToggle: (type: ReactionType) => void;
  /** Loading state */
  loading?: boolean;
  /** Disabled */
  disabled?: boolean;
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

const REACTION_LABELS: Record<ReactionType, string> = {
  like: "Like",
  love: "Love",
  haha: "Haha",
  wow: "Wow",
  sad: "Sad",
  angry: "Angry",
};

export function ReactionBar({
  counts,
  userTypes,
  onToggle,
  loading = false,
  disabled = false,
  className,
}: ReactionBarProps) {
  const hasReactions = (counts?.length ?? 0) > 0;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Existing reactions */}
      {hasReactions && (
        <div className="flex items-center gap-1">
          {counts.map(({ type, count }) => (
            <Button
              key={type}
              variant={userTypes.includes(type) ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2 text-sm"
              onClick={() => onToggle(type)}
              disabled={disabled || loading}
            >
              <span className="mr-1">{REACTION_EMOJIS[type]}</span>
              <span>{count}</span>
            </Button>
          ))}
        </div>
      )}

      {/* Add reaction button */}
      <Popover>
        <PopoverTrigger
          render={
            <Button variant="ghost" size="sm" className="h-7 px-2" disabled={disabled || loading}>
              <SmilePlus className="size-3.5" />
            </Button>
          }
        />
        <PopoverContent className="w-auto p-2" align="start">
          <div className="flex gap-1">
            {(Object.keys(REACTION_EMOJIS) as ReactionType[]).map((type) => (
              <Button
                key={type}
                variant={userTypes.includes(type) ? "secondary" : "ghost"}
                size="sm"
                className="h-8 w-8 p-0 text-lg"
                onClick={() => {
                  onToggle(type);
                }}
                disabled={disabled || loading}
                title={REACTION_LABELS[type]}
              >
                {REACTION_EMOJIS[type]}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
