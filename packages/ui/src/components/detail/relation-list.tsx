/**
 * 관계 목록. MetaDot + 대상 이름 + 관계 유형.
 * 상세 페이지 메타 사이드바에서 사용.
 */

import { cn } from "@repo/ui/lib/utils";
import type { EntityType } from "../primitives";
import { MetaDot } from "../primitives";

interface Props {
  relations: {
    targetName: string;
    targetType: EntityType;
    relationType: string;
  }[];
  onRelationClick?: (index: number) => void;
  className?: string;
}

export function RelationList({ relations, onRelationClick, className }: Props) {
  return (
    <div className={cn("flex flex-col gap-1", className)} data-testid="relation-list">
      {relations.map((relation, index) => (
        <button
          key={`${relation.targetType}-${relation.targetName}`}
          type="button"
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted hover:text-foreground"
          onClick={() => onRelationClick?.(index)}
          data-testid="relation-list.item"
        >
          <MetaDot type={relation.targetType} />
          <span className="flex-1 truncate text-sm">{relation.targetName}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{relation.relationType}</span>
        </button>
      ))}
    </div>
  );
}
