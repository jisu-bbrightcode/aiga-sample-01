import { cn } from "@repo/ui/lib/utils";

interface ProgressBarProps {
  percentage: number;
  width?: string;
  className?: string;
}

function getProgressColor(percentage: number): string {
  if (percentage >= 80) return "bg-green-500";
  if (percentage >= 40) return "bg-amber-500";
  return "bg-red-500";
}

export function ProgressBar({ percentage, width = "w-20", className }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, percentage));

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn("h-0.5 rounded-full bg-muted", width)}>
        <div
          className={cn("h-full rounded-full transition-all", getProgressColor(clamped))}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">{Math.round(clamped)}%</span>
    </div>
  );
}
