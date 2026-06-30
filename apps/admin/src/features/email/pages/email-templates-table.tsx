import { Badge } from "@repo/ui/shadcn/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/shadcn/table";
import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { EmailCategoryBadge } from "../components/email-category-badge";
import { EmailStatusBadge } from "../components/email-status-badge";
import { EmailTemplateStatusBadge } from "../components/email-template-status-badge";
import type { EmailTemplateSummary } from "../templates-types";

interface EmailTemplatesTableProps {
  templates: EmailTemplateSummary[];
  isLoading?: boolean;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "-";
  return format(parsed, "yyyy.MM.dd HH:mm", { locale: ko });
}

/**
 * 이메일 템플릿 목록 테이블.
 *
 * 각 행은 상세 화면으로 연결되며, 현재 버전 상태·카테고리·활성 여부·마지막
 * 발송 상태 요약을 한눈에 보여준다.
 */
export function EmailTemplatesTable({ templates, isLoading }: EmailTemplatesTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">로딩 중...</div>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">등록된 이메일 템플릿이 없습니다.</div>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>이름</TableHead>
          <TableHead>카테고리</TableHead>
          <TableHead>현재 버전</TableHead>
          <TableHead>활성</TableHead>
          <TableHead>마지막 발송</TableHead>
          <TableHead>최근 수정</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {templates.map((template) => (
          <TableRow key={template.key}>
            <TableCell className="font-medium">
              <Link
                to="/email-templates/$key"
                params={{ key: template.key }}
                className="text-primary hover:underline"
              >
                {template.name}
              </Link>
              <div className="text-xs text-muted-foreground">{template.key}</div>
            </TableCell>
            <TableCell>
              <EmailCategoryBadge category={template.category} />
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <EmailTemplateStatusBadge status={template.currentStatus} />
                {template.currentVersion === null ? null : (
                  <span className="text-xs text-muted-foreground">v{template.currentVersion}</span>
                )}
              </div>
            </TableCell>
            <TableCell>
              {template.isActive ? (
                <Badge variant="success">활성</Badge>
              ) : (
                <Badge variant="outline">보관됨</Badge>
              )}
            </TableCell>
            <TableCell>
              {template.lastSend.lastStatus ? (
                <div className="flex items-center gap-2">
                  <EmailStatusBadge status={template.lastSend.lastStatus} />
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(template.lastSend.lastSentAt)}
                  </span>
                </div>
              ) : (
                <span className="text-muted-foreground">발송 이력 없음</span>
              )}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {formatDateTime(template.updatedAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
