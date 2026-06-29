/**
 * 엔티티 타입에 맞는 lucide 아이콘 반환.
 */

import { cn } from "@repo/ui/lib/utils";
import { BookOpen, Globe, MapPin, Shield, User } from "lucide-react";
import type { EntityType } from "./entity-badge";

interface Props {
  type: EntityType;
  className?: string;
  size?: number;
}

const TYPE_ICONS = {
  world: Globe,
  character: User,
  location: MapPin,
  faction: Shield,
  codex: BookOpen,
} as const;

export function TypeIcon({ type, className, size = 16 }: Props) {
  const Icon = TYPE_ICONS[type];

  return (
    <Icon className={cn("shrink-0", className)} size={size} data-testid={`type-icon-${type}`} />
  );
}
