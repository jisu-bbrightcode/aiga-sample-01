/**
 * 상세 페이지 헤더. 뒤로가기, 타입 뱃지, 제목, 설명, 액션 버튼.
 */

import { cn } from "@repo/ui/lib/utils";
import { ChevronLeft, Pencil, Trash2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import type { EntityType } from "../primitives";
import { EntityBadge } from "../primitives";

interface Props {
  title: string;
  type: EntityType;
  description?: string;
  onBack?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  className?: string;
}

export function DetailHeader({
  title,
  type,
  description,
  onBack,
  onEdit,
  onDelete,
  className,
}: Props) {
  return (
    <div
      className={cn("flex items-start justify-between gap-4", className)}
      data-testid="detail-header"
    >
      <div className="flex items-start gap-3">
        {onBack && (
          <Button
            variant="ghost"
            size="icon"
            className="mt-0.5 size-8 shrink-0"
            onClick={onBack}
            data-testid="detail-header.back"
          >
            <ChevronLeft className="size-3.5" />
          </Button>
        )}
        <div className="flex flex-col gap-1.5">
          <EntityBadge type={type} />
          <h1 className="text-xl font-semibold leading-tight">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {onEdit && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={onEdit}
            data-testid="detail-header.edit"
          >
            <Pencil className="size-3.5" />
            <span>편집</span>
          </Button>
        )}
        {onDelete && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-destructive hover:text-destructive"
            onClick={onDelete}
            data-testid="detail-header.delete"
          >
            <Trash2 className="size-3.5" />
            <span>삭제</span>
          </Button>
        )}
      </div>
    </div>
  );
}
