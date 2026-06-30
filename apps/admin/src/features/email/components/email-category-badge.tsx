import { Badge } from "@repo/ui/shadcn/badge";
import type { TemplateCategory } from "../templates-types";
import { TEMPLATE_CATEGORY_LABELS } from "../templates-types";

interface EmailCategoryBadgeProps {
  category: TemplateCategory;
}

/**
 * 템플릿 카테고리 배지 (인증 / 비밀번호 / 트랜잭션 / 마케팅).
 */
export function EmailCategoryBadge({ category }: EmailCategoryBadgeProps) {
  return (
    <Badge variant="outline" className="font-normal">
      {TEMPLATE_CATEGORY_LABELS[category]}
    </Badge>
  );
}
