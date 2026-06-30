import { Button } from "@repo/ui/shadcn/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/shadcn/card";
import { Input } from "@repo/ui/shadcn/input";
import { Label } from "@repo/ui/shadcn/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/shadcn/select";
import { Link } from "@tanstack/react-router";
import { Plus, RefreshCw, ScrollText } from "lucide-react";
import { useMemo, useState } from "react";
import { useEmailTemplates } from "../../hooks/use-email-templates";
import { EmailTemplateFormDialog } from "../../pages/email-template-form-dialog";
import { EmailTemplatesTable } from "../../pages/email-templates-table";
import type { TemplateCategory } from "../../templates-types";
import { TEMPLATE_CATEGORY_LABELS } from "../../templates-types";

type ActiveFilter = "all" | "active" | "archived";

const CATEGORY_OPTIONS = Object.keys(TEMPLATE_CATEGORY_LABELS) as TemplateCategory[];

/**
 * Admin Email Templates Page — `/email-templates`.
 *
 * 이메일 템플릿 목록/검색/필터 + 생성 진입점. 상세/발행/미리보기/테스트 발송은
 * 행을 클릭해 상세 화면에서 처리한다. PB-NOTI-EMAIL-ADMIN-001 / BBR-662.
 */
export function EmailTemplatesPage() {
  const { data, isLoading, isFetching, isError, error, refetch } = useEmailTemplates();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<TemplateCategory | undefined>();
  const [active, setActive] = useState<ActiveFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);

  const templates = useMemo(() => {
    const all = data ?? [];
    const term = search.trim().toLowerCase();
    return all.filter((template) => {
      if (category && template.category !== category) return false;
      if (active === "active" && !template.isActive) return false;
      if (active === "archived" && template.isActive) return false;
      if (term !== "") {
        const haystack = `${template.name} ${template.key}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [data, search, category, active]);

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">이메일 템플릿</h1>
          <p className="text-muted-foreground">
            이메일 템플릿을 생성·수정·발행하고 미리보기/테스트 발송을 관리합니다
          </p>
        </div>
        <Button variant="outline" size="sm" render={<Link to="/email-logs" />}>
          <ScrollText className="mr-2 size-3.5" />
          발송 이력
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>템플릿 목록</CardTitle>
              <CardDescription>
                현재 버전 상태와 마지막 발송 상태를 확인하고 검색·필터할 수 있습니다
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => refetch()} variant="outline" size="sm" disabled={isFetching}>
                <RefreshCw className={isFetching ? "mr-2 size-3.5 animate-spin" : "mr-2 size-3.5"} />
                새로고침
              </Button>
              <Button onClick={() => setCreateOpen(true)} size="sm">
                <Plus className="mr-2 size-3.5" />새 템플릿
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="flex-1">
              <Label htmlFor="template-search">검색 (이름 또는 키)</Label>
              <Input
                id="template-search"
                placeholder="템플릿 이름 또는 key"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="w-full md:w-[180px]">
              <Label htmlFor="template-category-filter">카테고리</Label>
              <Select
                value={category ?? "all"}
                onValueChange={(v: string | null) =>
                  setCategory(v === "all" || !v ? undefined : (v as TemplateCategory))
                }
              >
                <SelectTrigger id="template-category-filter" className="mt-1">
                  <SelectValue placeholder="전체" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {TEMPLATE_CATEGORY_LABELS[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full md:w-[160px]">
              <Label htmlFor="template-active-filter">활성 상태</Label>
              <Select value={active} onValueChange={(v: string | null) => setActive((v as ActiveFilter) ?? "all")}>
                <SelectTrigger id="template-active-filter" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="active">활성</SelectItem>
                  <SelectItem value="archived">보관됨</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isError ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="text-destructive">
                {error instanceof Error ? error.message : "목록을 불러오지 못했습니다."}
              </div>
              <Button onClick={() => refetch()} variant="outline" size="sm">
                다시 시도
              </Button>
            </div>
          ) : (
            <EmailTemplatesTable templates={templates} isLoading={isLoading} />
          )}

          {!isError && !isLoading && (
            <div className="text-sm text-muted-foreground">
              총 {templates.length.toLocaleString("ko-KR")}개 템플릿
            </div>
          )}
        </CardContent>
      </Card>

      <EmailTemplateFormDialog mode="create" open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
