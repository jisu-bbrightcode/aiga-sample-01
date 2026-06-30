import { Badge } from "@repo/ui/shadcn/badge";
import type { DomainResourceStatus } from "../types";
import { DOMAIN_STATUS_BADGE_VARIANT, DOMAIN_STATUS_LABELS } from "../types";

interface DomainStatusBadgeProps {
  status: DomainResourceStatus;
}

/**
 * 도메인 리소스 상태 배지 (초안 / 공개 / 보관됨).
 *
 * `published` is the only publicly-visible state, so it gets the success
 * colour; `draft`/`archived` read as muted admin-only states.
 */
export function DomainStatusBadge({ status }: DomainStatusBadgeProps) {
  return (
    <Badge variant={DOMAIN_STATUS_BADGE_VARIANT[status]}>{DOMAIN_STATUS_LABELS[status]}</Badge>
  );
}
