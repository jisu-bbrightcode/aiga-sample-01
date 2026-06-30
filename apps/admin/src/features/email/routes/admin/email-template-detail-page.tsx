import { Badge } from "@repo/ui/shadcn/badge";
import { Button } from "@repo/ui/shadcn/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/shadcn/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/shadcn/tabs";
import { Link, useParams } from "@tanstack/react-router";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { ArrowLeft, Pencil, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmailCategoryBadge } from "../../components/email-category-badge";
import { EmailTemplateStatusBadge } from "../../components/email-template-status-badge";
import {
  usePublishEmailTemplate,
  useSetEmailTemplateActive,
} from "../../hooks/use-email-template-mutations";
import { useEmailTemplate } from "../../hooks/use-email-template";
import { EmailTemplateFormDialog } from "../../pages/email-template-form-dialog";
import { EmailTemplatePreviewPanel } from "../../pages/email-template-preview-panel";
import { EmailTemplateTestSendPanel } from "../../pages/email-template-test-send-panel";
import type { EmailTemplateDetail } from "../../templates-types";

function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "-";
  return format(parsed, "yyyy.MM.dd HH:mm", { locale: ko });
}

/**
 * Admin Email Template Detail Page — `/email-templates/$key`.
 *
 * 메타데이터·버전 이력 + 수정/발행/보관 액션, 미리보기, 테스트 발송을 한 화면에서
 * 제공한다. PB-NOTI-EMAIL-ADMIN-001 / BBR-662.
 */
export function EmailTemplateDetailPage() {
  const { key } = useParams({ strict: false }) as { key: string };
  const { data: template, isLoading, isError, error, refetch } = useEmailTemplate(key);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-muted-foreground">로딩 중...</div>
      </div>
    );
  }

  if (isError || !template) {
    return (
      <div className="container mx-auto space-y-4 px-4 py-8">
        <BackLink />
        <div className="flex flex-col items-center gap-3 py-8">
          <div className="text-destructive">
            {error instanceof Error ? error.message : "템플릿을 불러오지 못했습니다."}
          </div>
          <Button onClick={() => refetch()} variant="outline" size="sm">
            다시 시도
          </Button>
        </div>
      </div>
    );
  }

  return <TemplateDetailContent template={template} />;
}

function BackLink() {
  return (
    <Button variant="ghost" size="sm" render={<Link to="/email-templates" />}>
      <ArrowLeft className="mr-2 size-3.5" />
      템플릿 목록
    </Button>
  );
}

function TemplateDetailContent({ template }: { template: EmailTemplateDetail }) {
  const [editOpen, setEditOpen] = useState(false);
  const publishMutation = usePublishEmailTemplate(template.key);
  const activeMutation = useSetEmailTemplateActive(template.key);

  const versions = [...template.versions].sort((a, b) => b.version - a.version);
  const publishedVersion = versions.find((version) => version.status === "published");
  const hasDraft = versions.some((version) => version.status === "draft");

  const handlePublish = async () => {
    if (!confirm("현재 draft를 발행하시겠습니까? 변수 스키마와 미리보기 검증을 통과해야 합니다.")) {
      return;
    }
    try {
      await publishMutation.mutateAsync(undefined);
      toast.success("템플릿을 발행했습니다.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "발행에 실패했습니다. 검증 결과를 확인해 주세요.",
      );
    }
  };

  const handleToggleActive = async () => {
    const next = !template.isActive;
    const confirmMessage = next
      ? "이 템플릿을 다시 활성화하시겠습니까?"
      : "이 템플릿을 보관(비활성화)하시겠습니까? 발송에 사용되지 않으며 이력은 보존됩니다.";
    if (!confirm(confirmMessage)) return;
    try {
      await activeMutation.mutateAsync(next);
      toast.success(next ? "템플릿을 활성화했습니다." : "템플릿을 보관했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "상태 변경에 실패했습니다.");
    }
  };

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <BackLink />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{template.name}</h1>
            {template.isActive ? (
              <Badge variant="success">활성</Badge>
            ) : (
              <Badge variant="outline">보관됨</Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <code className="text-sm text-muted-foreground">{template.key}</code>
            <EmailCategoryBadge category={template.category} />
            <EmailTemplateStatusBadge status={template.currentStatus} />
            {template.renderer ? (
              <Badge variant="outline" className="font-normal">
                렌더러: {template.renderer}
              </Badge>
            ) : null}
          </div>
          {template.description ? (
            <p className="max-w-2xl text-muted-foreground">{template.description}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 size-3.5" />
            수정
          </Button>
          <Button
            size="sm"
            onClick={handlePublish}
            disabled={!hasDraft || publishMutation.isPending}
          >
            <Send className="mr-2 size-3.5" />
            {publishMutation.isPending ? "발행 중..." : "draft 발행"}
          </Button>
          <Button
            variant={template.isActive ? "outline" : "default"}
            size="sm"
            onClick={handleToggleActive}
            disabled={activeMutation.isPending}
          >
            {template.isActive ? "보관" : "활성화"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="versions">
        <TabsList>
          <TabsTrigger value="versions">버전 이력</TabsTrigger>
          <TabsTrigger value="preview">미리보기</TabsTrigger>
          <TabsTrigger value="test-send">테스트 발송</TabsTrigger>
        </TabsList>

        <TabsContent value="versions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>발송 상태 요약</CardTitle>
              <CardDescription>이 템플릿으로 발송된 이메일의 최근 상태입니다</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-6 text-sm">
                <div>
                  <div className="text-muted-foreground">총 발송</div>
                  <div className="text-lg font-semibold">
                    {template.lastSend.totalCount.toLocaleString("ko-KR")}건
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">마지막 상태</div>
                  <div className="text-lg font-semibold">
                    {template.lastSend.lastStatus ?? "이력 없음"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">마지막 발송</div>
                  <div className="text-lg font-semibold">
                    {formatDateTime(template.lastSend.lastSentAt)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>버전</CardTitle>
              <CardDescription>draft/published/archived 버전 이력</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {versions.length === 0 ? (
                <div className="text-muted-foreground">버전이 없습니다.</div>
              ) : (
                versions.map((version) => (
                  <div
                    key={version.id}
                    className="flex flex-col gap-2 rounded-md border px-4 py-3 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">v{version.version}</span>
                        <EmailTemplateStatusBadge status={version.status} />
                        {version.isCurrent ? <Badge variant="secondary">현재</Badge> : null}
                      </div>
                      <div className="text-sm text-muted-foreground">제목: {version.subject}</div>
                      {version.changelog ? (
                        <div className="text-xs text-muted-foreground">
                          변경 이력: {version.changelog}
                        </div>
                      ) : null}
                      <div className="text-xs text-muted-foreground">
                        변수 {Object.keys(version.variableSchema).length}개
                        {version.publishedAt ? ` · 발행 ${formatDateTime(version.publishedAt)}` : ""}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview">
          <Card>
            <CardHeader>
              <CardTitle>미리보기</CardTitle>
              <CardDescription>발행된 버전의 제목/본문을 변수와 함께 렌더합니다</CardDescription>
            </CardHeader>
            <CardContent>
              <EmailTemplatePreviewPanel
                templateKey={template.key}
                publishedVersion={publishedVersion}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="test-send">
          <Card>
            <CardHeader>
              <CardTitle>테스트 발송</CardTitle>
              <CardDescription>
                지정한 수신자에게 실제로 발송하고 결과를 확인합니다 (발송 이력에 기록됨)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EmailTemplateTestSendPanel
                templateKey={template.key}
                publishedVersion={publishedVersion}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <EmailTemplateFormDialog
        mode="edit"
        template={template}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </div>
  );
}
