import { Badge } from "@repo/ui/shadcn/badge";
import type { EmailStatus } from "../../common/types";
import { EMAIL_STATUS_COLORS, EMAIL_STATUS_LABELS } from "../../common/types";

interface EmailStatusBadgeProps {
  status: EmailStatus;
}

/**
 * 이메일 상태 배지
 */
export function EmailStatusBadge({ status }: EmailStatusBadgeProps) {
  const variant = EMAIL_STATUS_COLORS[status];
  const label = EMAIL_STATUS_LABELS[status];

  return (
    <Badge variant={variant || "default"} className="capitalize">
      {label}
    </Badge>
  );
}
