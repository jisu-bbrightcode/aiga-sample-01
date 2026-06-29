/**
 * 프로젝트 카드. 썸네일, 이름, 최근 활동, 엔티티 수.
 */

import { cn } from "@repo/ui/lib/utils";
import { Card, CardContent } from "~/components/ui/card";

interface Props {
  name: string;
  lastActivity?: string;
  entityCounts?: string;
  thumbnailUrl?: string;
  onClick?: () => void;
  className?: string;
}

export function ProjectCard({
  name,
  lastActivity,
  entityCounts,
  thumbnailUrl,
  onClick,
  className,
}: Props) {
  return (
    <Card
      className={cn(
        "cursor-pointer overflow-hidden transition-colors hover:bg-muted",
        className,
      )}
      onClick={onClick}
      data-testid="project-card"
    >
      {thumbnailUrl ? (
        <div className="aspect-video bg-muted">
          <img src={thumbnailUrl} alt={name} className="size-full object-cover" />
        </div>
      ) : (
        <div className="aspect-video bg-muted" />
      )}

      <CardContent className="flex flex-col gap-1 p-4">
        <h3 className="font-medium">{name}</h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {lastActivity && <span>{lastActivity}</span>}
          {lastActivity && entityCounts && <span aria-hidden="true">·</span>}
          {entityCounts && <span>{entityCounts}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
