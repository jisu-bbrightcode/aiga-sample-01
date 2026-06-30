import { Badge } from "@repo/ui/shadcn/badge";
import type { DomainResourceType } from "../types";
import { DOMAIN_TYPE_LABELS } from "../types";

interface DomainTypeBadgeProps {
  type: DomainResourceType;
}

/** 도메인 리소스 유형 배지 (의사 / 병원). */
export function DomainTypeBadge({ type }: DomainTypeBadgeProps) {
  return <Badge variant="outline">{DOMAIN_TYPE_LABELS[type]}</Badge>;
}
