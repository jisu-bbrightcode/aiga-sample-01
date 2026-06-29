/**
 * 엔티티 타입 표시용 작은 색상 점 (8px). 관계 목록 등에서 사용.
 */

import { cn } from "@repo/ui/lib/utils";
import type { EntityType } from "./entity-badge";

interface Props {
  type: EntityType;
  className?: string;
}

const DOT_COLORS: Record<EntityType, string> = {
  world: "bg-entity-world",
  character: "bg-entity-character",
  location: "bg-entity-location",
  faction: "bg-entity-faction",
  codex: "bg-entity-codex",
};

export function MetaDot({ type, className }: Props) {
  return (
    <span
      className={cn("inline-block size-2 shrink-0 rounded-full", DOT_COLORS[type], className)}
      data-testid={`meta-dot-${type}`}
      aria-hidden="true"
    />
  );
}
