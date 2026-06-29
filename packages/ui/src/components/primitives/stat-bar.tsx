/**
 * 콘텐츠 통계 바. count + label 쌍을 수평 나열.
 */

import { cn } from "@repo/ui/lib/utils";

interface StatItem {
  label: string;
  count: number;
}

interface Props {
  items: StatItem[];
  className?: string;
}

export function StatBar({ items, className }: Props) {
  return (
    <div className={cn("flex items-center gap-4", className)} data-testid="stat-bar">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{item.count}</span>
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
