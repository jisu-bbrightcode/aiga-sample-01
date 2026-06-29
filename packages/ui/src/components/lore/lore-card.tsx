/**
 * 세계관 엔티티 카드. 이미지, 타입 뱃지, 제목, 설명, 메타 정보.
 * 목록 그리드에서 사용.
 */

import { cn } from "@repo/ui/lib/utils";
import { Link2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import type { EntityType } from "../primitives";
import { EntityBadge } from "../primitives";

interface Props {
  title: string;
  description?: string;
  type: EntityType;
  imageUrl?: string;
  isSelected?: boolean;
  connections?: number;
  onClick?: () => void;
  className?: string;
}

export function LoreCard({
  title,
  description,
  type,
  imageUrl,
  isSelected,
  connections,
  onClick,
  className,
}: Props) {
  return (
    <Card
      className={cn(
        "cursor-pointer overflow-hidden transition-colors hover:bg-muted",
        isSelected && "ring-2 ring-ring",
        className,
      )}
      onClick={onClick}
      data-testid="lore-card"
    >
      {imageUrl ? (
        <div className="h-32 bg-muted">
          <img src={imageUrl} alt={title} className="size-full object-cover" />
        </div>
      ) : (
        <div className="h-32 bg-muted" />
      )}

      <CardHeader className="gap-2 p-4 pb-0">
        <EntityBadge type={type} />
        <h3 className="text-sm font-medium leading-tight">{title}</h3>
      </CardHeader>

      {(description || connections !== undefined) && (
        <CardContent className="p-4 pt-1">
          {description && (
            <p className="line-clamp-2 text-xs text-muted-foreground">{description}</p>
          )}
          {connections !== undefined && connections > 0 && (
            <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
              <Link2 className="size-3.5" />
              <span>{connections}개 연결</span>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
