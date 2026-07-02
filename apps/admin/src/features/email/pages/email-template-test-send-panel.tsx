import { Button } from "@repo/ui/shadcn/button";
import { Input } from "@repo/ui/shadcn/input";
import { Label } from "@repo/ui/shadcn/label";
import { Textarea } from "@repo/ui/shadcn/textarea";
import { useState } from "react";
import { toast } from "sonner";
import { EmailStatusBadge } from "../components/email-status-badge";
import { useTestSendEmailTemplate } from "../hooks/use-email-template-actions";
import { buildSampleVariables, parseJsonObject } from "../lib/template-variables";
import type { EmailTemplateVersion } from "../templates-types";

interface EmailTemplateTestSendPanelProps {
  templateKey: string;
  publishedVersion: EmailTemplateVersion | undefined;
}

const FAILED_STATUSES = new Set(["failed", "bounced"]);

/**
 * 템플릿 테스트 발송 패널.
 *
 * 실제 provider로 발송하고 결과(성공/실패 + 실패 사유 + provider id)를 명확히
 * 표시한다(AC: 실패 상태 명확 표시). 변수는 JSON으로 입력하며 생략 시 서버가
 * 스키마에서 샘플을 합성한다.
 */
export function EmailTemplateTestSendPanel({
  templateKey,
  publishedVersion,
}: EmailTemplateTestSendPanelProps) {
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [variablesText, setVariablesText] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const testSend = useTestSendEmailTemplate(templateKey);

  const hasPublished = !!publishedVersion;
  const result = testSend.data;
  const failed = result ? FAILED_STATUSES.has(result.status) : false;

  const handleSend = async () => {
    setInputError(null);

    if (recipientEmail.trim() === "") {
      setInputError("테스트 수신자 이메일을 입력해 주세요.");
      return;
    }

    const parsed = parseJsonObject(variablesText);
    if (!parsed.ok) {
      setInputError(parsed.error);
      return;
    }

    try {
      const sent = await testSend.mutateAsync({
        recipientEmail: recipientEmail.trim(),
        ...(recipientName.trim() === "" ? {} : { recipientName: recipientName.trim() }),
        ...(Object.keys(parsed.value).length > 0 ? { variables: parsed.value } : {}),
      });
      if (FAILED_STATUSES.has(sent.status)) {
        toast.error("테스트 발송이 실패했습니다. 결과를 확인해 주세요.");
      } else {
        toast.success("테스트 메일을 발송했습니다.");
      }
    } catch (error) {
      setInputError(
        error instanceof Error ? error.message : "테스트 발송에 실패했습니다. 다시 시도해 주세요.",
      );
    }
  };

  const handleFillSample = () => {
    setVariablesText(JSON.stringify(buildSampleVariables(publishedVersion?.variableSchema), null, 2));
  };

  return (
    <div className="space-y-4">
      {!hasPublished && (
        <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-700 dark:text-yellow-400">
          발행된 버전이 없어 테스트 발송을 할 수 없습니다. 먼저 draft를 발행해 주세요.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="test-email">수신자 이메일</Label>
          <Input
            id="test-email"
            type="email"
            placeholder="ops@example.com"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="test-name">수신자 이름 (선택)</Label>
          <Input
            id="test-name"
            placeholder="홍길동"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="test-variables">변수 (JSON, 선택)</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleFillSample}
            disabled={!hasPublished}
          >
            샘플 변수 채우기
          </Button>
        </div>
        <Textarea
          id="test-variables"
          rows={4}
          className="font-mono text-xs"
          placeholder={'생략 시 스키마에서 샘플을 자동 생성합니다. 예: { "name": "홍길동" }'}
          value={variablesText}
          onChange={(e) => setVariablesText(e.target.value)}
        />
        {inputError && <p className="text-sm text-destructive whitespace-pre-wrap">{inputError}</p>}
      </div>

      <Button onClick={handleSend} disabled={!hasPublished || testSend.isPending}>
        {testSend.isPending ? "발송 중..." : "테스트 발송"}
      </Button>

      {result && (
        <div
          className={
            failed
              ? "rounded-md border border-destructive/40 bg-destructive/10 px-3 py-3 text-sm"
              : "rounded-md border border-green-500/40 bg-green-500/10 px-3 py-3 text-sm"
          }
        >
          <div className="flex items-center gap-2">
            <span className="font-medium">발송 결과</span>
            <EmailStatusBadge status={result.status} />
          </div>
          <dl className="mt-2 space-y-1 text-muted-foreground">
            <div className="flex gap-2">
              <dt className="w-24 shrink-0">수신자</dt>
              <dd className="break-all">{result.recipientEmail}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-24 shrink-0">제목</dt>
              <dd className="break-all">{result.subject}</dd>
            </div>
            {result.providerMessageId && (
              <div className="flex gap-2">
                <dt className="w-24 shrink-0">Provider ID</dt>
                <dd className="break-all">{result.providerMessageId}</dd>
              </div>
            )}
            {result.failureReason && (
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 text-destructive">실패 사유</dt>
                <dd className="break-all text-destructive">{result.failureReason}</dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </div>
  );
}
