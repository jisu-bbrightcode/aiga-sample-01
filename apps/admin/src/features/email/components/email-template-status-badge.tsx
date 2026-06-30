import { Badge } from "@repo/ui/shadcn/badge";
import type { TemplateVersionStatus } from "../templates-types";
import { TEMPLATE_STATUS_BADGE_VARIANT, TEMPLATE_STATUS_LABELS } from "../templates-types";

interface EmailTemplateStatusBadgeProps {
  status: TemplateVersionStatus | null;
}

/**
 * 템플릿 현재 버전 상태 배지 (초안 / 발행됨 / 보관됨).
 * `null`(버전 없음)인 경우 미발행 상태로 표시.
 */
export function EmailTemplateStatusBadge({ status }: EmailTemplateStatusBadgeProps) {
  if (status === null) {
    return <Badge variant="outline">버전 없음</Badge>;
  }
  return <Badge variant={TEMPLATE_STATUS_BADGE_VARIANT[status]}>{TEMPLATE_STATUS_LABELS[status]}</Badge>;
}
