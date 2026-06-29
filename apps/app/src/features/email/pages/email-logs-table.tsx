import { useFeatureTranslation } from "@repo/core/i18n";
import { Button } from "@repo/ui/shadcn/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/shadcn/table";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Eye, RefreshCw } from "lucide-react";
import { useState } from "react";
import { AppQuietLoadingState } from "@/components/app-loading";
import { getAppErrorMessage } from "@/lib/user-facing-error";
import type { EmailLogSerialized } from "../../common/types";
import { EmailStatusBadge } from "../components/email-status-badge";
import { EmailTemplateBadge } from "../components/email-template-badge";
import { useResendEmail } from "../hooks/use-resend-email";
import { EmailLogDetailModal } from "./email-log-detail-modal";

interface EmailLogsTableProps {
  logs: EmailLogSerialized[];
  isLoading?: boolean;
}

/**
 * 이메일 로그 테이블
 */
export function EmailLogsTable({ logs, isLoading }: EmailLogsTableProps) {
  const { t } = useFeatureTranslation("app");
  const [selectedLogId, setSelectedLogId] = useState<string | undefined>();
  const resendEmail = useResendEmail();

  const handleResend = async (logId: string) => {
    if (confirm(t("email.resendConfirm"))) {
      try {
        await resendEmail.mutateAsync(logId);
        alert(t("email.resendSuccess"));
      } catch (error) {
        alert(getAppErrorMessage(t, error, "errors.emailResend"));
      }
    }
  };

  if (isLoading) {
    return <AppQuietLoadingState label={t("email.logs.loading")} variant="inline" />;
  }

  if (logs.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">이메일 로그가 없습니다.</div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>수신자</TableHead>
              <TableHead>템플릿</TableHead>
              <TableHead>제목</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>발송 시각</TableHead>
              <TableHead>재시도</TableHead>
              <TableHead className="text-right">작업</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell>
                  <div className="font-medium">{log.recipientEmail}</div>
                  {log.recipientName && (
                    <div className="text-muted-foreground text-sm">{log.recipientName}</div>
                  )}
                </TableCell>
                <TableCell>
                  <EmailTemplateBadge templateType={log.templateType} />
                </TableCell>
                <TableCell className="max-w-[300px] truncate">{log.subject}</TableCell>
                <TableCell>
                  <EmailStatusBadge status={log.status} />
                </TableCell>
                <TableCell>
                  {log.sentAt ? (
                    <time dateTime={log.sentAt}>
                      {format(new Date(log.sentAt), "yyyy-MM-dd HH:mm", { locale: ko })}
                    </time>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className="text-muted-foreground text-sm">{log.retryCount}회</span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedLogId(log.id)}>
                      <Eye className="size-3.5" />
                    </Button>
                    {(log.status === "failed" || log.status === "bounced") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleResend(log.id)}
                        disabled={resendEmail.isPending}
                      >
                        <RefreshCw className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* 상세 모달 */}
      <EmailLogDetailModal logId={selectedLogId} onClose={() => setSelectedLogId(undefined)} />
    </>
  );
}
