/**
 * Entity Card — Lore list grid card (legacy, replaced by MemoCard pattern).
 */

import { useFeatureTranslation } from "@repo/core/i18n";
import { cn } from "@repo/ui/lib/utils";
import { Badge } from "@repo/ui/shadcn/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/shadcn/card";
import { BookOpen, Globe, MapPin, Shield, UserRound } from "lucide-react";

interface Props {
  id: string;
  name: string;
  description?: string | null;
  entityType: "world" | "character" | "location" | "faction" | "codex";
  updatedAt?: string | null;
  onClick: () => void;
  className?: string;
}

const ENTITY_TYPE_ICON: Record<Props["entityType"], typeof Globe> = {
  world: Globe,
  character: UserRound,
  location: MapPin,
  faction: Shield,
  codex: BookOpen,
};

const ENTITY_TYPE_LABEL_KEY: Record<Props["entityType"], string> = {
  world: "entity.card.type.world",
  character: "entity.card.type.character",
  location: "entity.card.type.location",
  faction: "entity.card.type.faction",
  codex: "entity.card.type.codex",
};

export function EntityCard({
  name,
  description,
  entityType,
  updatedAt,
  onClick,
  className,
}: Props) {
  const { t } = useFeatureTranslation("feature.story");
  const Icon = ENTITY_TYPE_ICON[entityType];
  const label = t(ENTITY_TYPE_LABEL_KEY[entityType]);

  return (
    <Card
      className={cn("cursor-pointer transition-colors hover:bg-muted", className)}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="gap-1 text-xs font-normal">
            <Icon className="size-3" />
            {label}
          </Badge>
          {updatedAt ? (
            <span className="text-xs text-muted-foreground">
              {formatRelativeDate(updatedAt, t)}
            </span>
          ) : null}
        </div>
        <CardTitle className="text-sm font-medium leading-snug">{name}</CardTitle>
      </CardHeader>
      {description ? (
        <CardContent className="pb-4">
          <p className="line-clamp-2 text-xs text-muted-foreground">{description}</p>
        </CardContent>
      ) : null}
    </Card>
  );
}

/* Helpers */

function formatRelativeDate(dateStr: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return t("entity.card.justNow");
  if (diffMin < 60) return t("entity.card.minutesAgo", { count: diffMin });
  if (diffHour < 24) return t("entity.card.hoursAgo", { count: diffHour });
  if (diffDay < 30) return t("entity.card.daysAgo", { count: diffDay });
  return date.toLocaleDateString("ko-KR");
}
