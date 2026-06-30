import { Button } from "@repo/ui/shadcn/button";
import { Label } from "@repo/ui/shadcn/label";
import { Textarea } from "@repo/ui/shadcn/textarea";
import { useState } from "react";
import { usePreviewEmailTemplate } from "../hooks/use-email-template-actions";
import { buildSampleVariables, parseJsonObject, summarizeValidation } from "../lib/template-variables";
import type { EmailTemplateVersion } from "../templates-types";

interface EmailTemplatePreviewPanelProps {
  templateKey: string;
  publishedVersion: EmailTemplateVersion | undefined;
}

/**
 * 템플릿 미리보기 패널.
 *
 * 변수 JSON을 입력해 발행된 버전의 subject/body를 렌더하고, 변수 검증 리포트를
 * 함께 보여준다. 본문 HTML은 sandbox iframe(srcDoc)으로 격리 렌더한다.
 */
export function EmailTemplatePreviewPanel({
  templateKey,
  publishedVersion,
}: EmailTemplatePreviewPanelProps) {
  const [variablesText, setVariablesText] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const preview = usePreviewEmailTemplate(templateKey);

  const hasPublished = !!publishedVersion;

  const handlePreview = () => {
    setInputError(null);
    const parsed = parseJsonObject(variablesText);
    if (!parsed.ok) {
      setInputError(parsed.error);
      return;
    }
    preview.mutate(parsed.value);
  };

  const handleFillSample = () => {
    setVariablesText(JSON.stringify(buildSampleVariables(publishedVersion?.variableSchema), null, 2));
  };

  const result = preview.data;
  const validationLines = summarizeValidation(result?.validation);

  return (
    <div className="space-y-4">
      {!hasPublished && (
        <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-700 dark:text-yellow-400">
          발행된 버전이 없어 미리보기를 생성할 수 없습니다. 먼저 draft를 발행해 주세요.
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="preview-variables">미리보기 변수 (JSON)</Label>
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
          id="preview-variables"
          rows={5}
          className="font-mono text-xs"
          placeholder={'{ "name": "홍길동" }'}
          value={variablesText}
          onChange={(e) => setVariablesText(e.target.value)}
        />
        {inputError && <p className="text-sm text-destructive">{inputError}</p>}
      </div>

      <Button onClick={handlePreview} disabled={!hasPublished || preview.isPending}>
        {preview.isPending ? "생성 중..." : "미리보기 생성"}
      </Button>

      {preview.isError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {preview.error instanceof Error ? preview.error.message : "미리보기를 생성하지 못했습니다."}
        </div>
      )}

      {result && (
        <div className="space-y-3">
          {!result.validation.valid && (
            <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-700 dark:text-yellow-400">
              <div className="font-medium">변수 검증 경고</div>
              <ul className="mt-1 list-disc pl-4">
                {validationLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-1">
            <Label>제목</Label>
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">{result.subject}</div>
            {result.subjectMissing.length > 0 && (
              <p className="text-xs text-yellow-700 dark:text-yellow-400">
                제목에 채워지지 않은 변수: {result.subjectMissing.join(", ")}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label>본문</Label>
            <iframe
              title="이메일 본문 미리보기"
              sandbox=""
              srcDoc={result.html}
              className="h-96 w-full rounded-md border bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}
