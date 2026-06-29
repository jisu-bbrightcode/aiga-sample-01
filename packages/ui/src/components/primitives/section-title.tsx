/**
 * 메타 사이드바용 섹션 구분 타이틀. 작고 뮤트된 텍스트.
 */

import { cn } from "@repo/ui/lib/utils";

interface Props {
  title: string;
  className?: string;
}

export function SectionTitle({ title, className }: Props) {
  return (
    <h3
      className={cn(
        "text-xs font-medium uppercase tracking-wider text-muted-foreground",
        className,
      )}
      data-testid="section-title"
    >
      {title}
    </h3>
  );
}
