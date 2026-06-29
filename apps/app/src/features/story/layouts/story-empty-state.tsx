/**
 * Empty state — centered, minimal, clean typography.
 */
import { cn } from "@repo/ui/lib/utils";

interface Props {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  className?: string;
  "data-el"?: string;
}

export function StoryEmptyState({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  className,
  "data-el": dataEl,
}: Props) {
  return (
    <div
      data-el={dataEl}
      className={cn("flex flex-col items-center justify-center py-20 text-center", className)}
    >
      {icon ? (
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
          {icon}
        </div>
      ) : null}

      <h3 className="text-sm font-medium text-foreground">{title}</h3>

      {description ? (
        <p className="mt-1 max-w-[360px] text-sm text-muted-foreground">{description}</p>
      ) : null}

      {primaryAction || secondaryAction ? (
        <div className="mt-4 flex items-center gap-2">
          {primaryAction}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}
