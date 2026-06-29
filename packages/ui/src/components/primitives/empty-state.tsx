/**
 * 빈 상태 UI. 아이콘 + 제목 + 설명 + 선택적 CTA.
 * 부모 컨테이너 중앙 정렬.
 */

import { cn } from "@repo/ui/lib/utils";
import type { ReactNode } from "react";
import { Button } from "~/components/ui/button";

interface Props {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({ icon, title, description, actionLabel, onAction, className }: Props) {
  return (
    <div
      className={cn("flex flex-col items-center justify-center gap-3 py-16 text-center", className)}
      data-testid="empty-state"
    >
      {icon ? (
        <div className="text-muted-foreground/60" data-testid="empty-state-icon">
          {icon}
        </div>
      ) : null}
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description ? <p className="max-w-xs text-sm text-muted-foreground">{description}</p> : null}
      {actionLabel && onAction ? (
        <Button
          variant="default"
          size="sm"
          onClick={onAction}
          className="mt-1"
          data-testid="empty-state-cta"
        >
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
