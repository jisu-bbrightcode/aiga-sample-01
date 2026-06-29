interface SummaryBarProps {
  completed: number;
  inProgress: number;
  pending: number;
  total: number;
}

export function SummaryBar({ completed, inProgress, pending, total }: SummaryBarProps) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="flex items-center gap-4 px-5 py-2.5 text-xs text-muted-foreground/50">
      <span className="flex items-center gap-1.5">
        <span className="inline-block size-1.5 rounded-full bg-green-500" />
        완료 {completed}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block size-1.5 rounded-full bg-amber-500" />
        진행중 {inProgress}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block size-1.5 rounded-full bg-gray-400" />
        미번역 {pending}
      </span>

      <span className="ml-auto tabular-nums">
        {total}개 중 {completed}개 완료 ({pct}%)
      </span>
    </div>
  );
}
