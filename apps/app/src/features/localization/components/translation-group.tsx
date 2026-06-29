import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/shadcn/button";
import { ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { ProgressBar } from "./progress-bar";

interface TranslationGroupProps {
  name: string;
  totalStrings: number;
  percentage: number;
  onAiTranslate?: () => void;
  defaultExpanded?: boolean;
  children: ReactNode;
}

export function TranslationGroup({
  name,
  totalStrings,
  percentage,
  onAiTranslate,
  defaultExpanded = false,
  children,
}: TranslationGroupProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div>
      {/* Group header */}
      <div
        className={cn(
          "sticky top-0 z-10 flex items-center gap-3 bg-muted/20 px-4 py-2.5",
          "cursor-pointer select-none transition-colors hover:bg-muted",
        )}
        onClick={() => setExpanded((prev) => !prev)}
      >
        {/* Chevron */}
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground">
          {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </span>

        {/* Group name */}
        <span className="text-sm font-semibold">{name}</span>

        {/* String count */}
        <span className="text-xs text-muted-foreground">{totalStrings}개 문자열</span>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Progress bar + AI translate button */}
        <div className="flex items-center gap-3">
          <ProgressBar percentage={percentage} />
          {percentage < 100 && onAiTranslate ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onAiTranslate();
              }}
            >
              <Sparkles className="size-3.5" />
              AI 번역
            </Button>
          ) : null}
        </div>
      </div>

      {/* Children (expanded content) */}
      {expanded ? <div>{children}</div> : null}
    </div>
  );
}
