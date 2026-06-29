/**
 * 엔티티 타입 뱃지. 세계/캐릭터/장소/세력/코덱스 각각 고유 색상.
 * entity-* 시맨틱 토큰 사용 (styles.css @theme).
 */

import { cn } from "@repo/ui/lib/utils";
import { Badge } from "~/components/ui/badge";

export type EntityType = "world" | "character" | "location" | "faction" | "codex";

interface Props {
  type: EntityType;
  className?: string;
}

const TYPE_LABELS: Record<EntityType, string> = {
  world: "세계",
  character: "캐릭터",
  location: "장소",
  faction: "세력",
  codex: "코덱스",
};

const TYPE_STYLES: Record<EntityType, string> = {
  world: "bg-entity-world/10 text-entity-world",
  character: "bg-entity-character/10 text-entity-character",
  location: "bg-entity-location/10 text-entity-location",
  faction: "bg-entity-faction/10 text-entity-faction",
  codex: "bg-entity-codex/10 text-entity-codex",
};

export function EntityBadge({ type, className }: Props) {
  return (
    <Badge
      variant="outline"
      className={cn("border-transparent font-medium", TYPE_STYLES[type], className)}
      data-testid={`entity-badge-${type}`}
    >
      {TYPE_LABELS[type]}
    </Badge>
  );
}
