/**
 * Relations list matching design: each row is flex justify-between.
 * Left: [avatar 16px circle] [name 13px]. Right: [relation type 13px muted].
 * "+ 연결 추가" link at bottom.
 */

import { useFeatureTranslation } from "@repo/core/i18n";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/shadcn/button";
import { X } from "lucide-react";

interface RelationItem {
  id: string;
  targetEntityId: string;
  targetEntityType: string;
  targetEntityName?: string;
  label?: string | null;
}

interface Props {
  relations: RelationItem[];
  onRemove?: (relationId: string) => void;
  onNavigate?: (entityType: string, entityId: string) => void;
  onAdd?: () => void;
  className?: string;
  "data-el"?: string;
}

export function RelationList({
  relations,
  onRemove,
  onNavigate,
  onAdd,
  className,
  "data-el": dataEl,
}: Props) {
  const { t } = useFeatureTranslation("feature.story");
  return (
    <div data-el={dataEl} className={cn("flex flex-col", className)}>
      {relations.length > 0 ? (
        <div className="flex flex-col gap-0.5">
          {relations.map((rel) => (
            <RelationRow key={rel.id} relation={rel} onRemove={onRemove} onNavigate={onNavigate} />
          ))}
        </div>
      ) : (
        <p className="text-base text-muted-foreground">{t("relation.empty")}</p>
      )}
      {onAdd ? (
        <div className="py-xs">
          <span
            className="cursor-default text-base text-muted-foreground"
            onClick={onAdd}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onAdd();
            }}
          >
            {t("relation.add")}
          </span>
        </div>
      ) : null}
    </div>
  );
}

/* Components */

interface RelationRowProps {
  relation: RelationItem;
  onRemove?: (relationId: string) => void;
  onNavigate?: (entityType: string, entityId: string) => void;
}

function RelationRow({ relation, onRemove, onNavigate }: RelationRowProps) {
  const { t } = useFeatureTranslation("feature.story");
  const initial = (relation.targetEntityName ?? relation.targetEntityId).charAt(0).toUpperCase();

  return (
    <div className="group flex items-center justify-between py-xs text-base">
      <span className="flex items-center gap-1.5">
        <RelationAvatar initial={initial} />
        <Button
          variant="ghost"
          className="h-auto p-0 text-base text-muted-foreground hover:text-foreground"
          onClick={() => onNavigate?.(relation.targetEntityType, relation.targetEntityId)}
        >
          {relation.targetEntityName ?? relation.targetEntityId}
        </Button>
      </span>

      <span className="flex items-center gap-1">
        {relation.label ? (
          <span className="text-base text-muted-foreground">{relation.label}</span>
        ) : null}
        {onRemove ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
            onClick={() => onRemove(relation.id)}
            aria-label={t("relation.removeAria")}
          >
            <X className="size-3.5" />
          </Button>
        ) : null}
      </span>
    </div>
  );
}

function RelationAvatar({ initial }: { initial: string }) {
  return (
    <div className="flex size-4 shrink-0 items-center justify-center rounded-full bg-muted text-2xs font-semibold text-muted-foreground">
      {initial}
    </div>
  );
}
