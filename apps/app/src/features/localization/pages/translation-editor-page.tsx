import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/shadcn/button";
import { Skeleton } from "@repo/ui/shadcn/skeleton";
import { Textarea } from "@repo/ui/shadcn/textarea";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, ChevronLeft, Languages, Lock, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { QuietLoadingIndicator } from "@/components/app-loading";
import { EditorGlossaryPanel } from "../components/editor-glossary-panel";
import { StatusBadge } from "../components/status-badge";
import { useUpdateTranslation } from "../hooks/use-localization-mutations";
import {
  useLanguage,
  useTranslation,
  useTranslationProgress,
  useTranslations,
} from "../hooks/use-localization-queries";

export function TranslationEditorPage() {
  const params = useParams({ strict: false }) as {
    projectId: string;
    langId: string;
  };
  const projectId = params.projectId;
  const translationId = params.langId; // route param is $langId but used as translationId
  const search = useSearch({ strict: false }) as { lang?: string };
  const langId = search.lang ?? "";
  const navigate = useNavigate();

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editedText, setEditedText] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  // --- Data ---
  const { data: translation, isLoading: translationLoading } = useTranslation(translationId);
  const { data: language } = useLanguage(langId);
  const { data: allTranslations } = useTranslations(projectId, langId);
  const { data: progress } = useTranslationProgress(projectId, langId);
  const updateMutation = useUpdateTranslation(projectId, langId);

  const translationList = (allTranslations ?? []) as Array<{
    id: string;
    sourceText?: string;
    targetText?: string;
    key?: string;
    title?: string;
    status?: string;
    entityType?: string;
    entityName?: string;
  }>;

  // Current index in list
  const currentIndex = translationList.findIndex((t) => t.id === translationId);
  const totalCount = translationList.length;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < totalCount - 1 && currentIndex >= 0;

  // Translation data
  const item = translation as
    | {
        id: string;
        sourceText?: string;
        targetText?: string;
        key?: string;
        title?: string;
        status?: string;
        entityType?: string;
        entityName?: string;
      }
    | undefined;

  const sourceText = item?.sourceText ?? "";
  const targetText = editedText === null ? (item?.targetText ?? "") : editedText;
  const status = (item?.status ?? "pending") as "pending" | "translated" | "reviewed" | "approved";
  const charCountSource = sourceText.length;
  const charCountTarget = targetText.length;

  // Reset edited text when translation changes
  useEffect(() => {
    setEditedText(null);
    setSavedAt(null);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // --- Handlers ---

  function handleTextChange(value: string) {
    setEditedText(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateMutation.mutate({ id: translationId, data: { translatedText: value } }, {
        onSuccess: () => setSavedAt(new Date()),
      });
    }, 1200);
  }

  function navigateTo(index: number) {
    const target = translationList[index];
    if (!target) return;
    navigate({
      to: `/p/${projectId}/localization/editor/${target.id}`,
      search: { lang: langId },
    });
  }

  function handlePrev() {
    if (hasPrev) navigateTo(currentIndex - 1);
  }

  function handleNext() {
    if (hasNext) navigateTo(currentIndex + 1);
  }

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        if (editedText !== null) {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          updateMutation.mutate(
            {
              id: translationId,
              data: { translatedText: editedText },
            },
            { onSuccess: () => setSavedAt(new Date()) },
          );
        }
      }
      // Alt+ArrowLeft / Alt+ArrowRight for prev/next
      if (e.altKey && e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      }
      if (e.altKey && e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const percentage = progress?.percentage ?? 0;

  return (
    <div className="bg-background flex h-full flex-col">
      {/* ─── Header Bar ─── */}
      <div className="border-border bg-muted/20 flex h-11 shrink-0 items-center gap-3 border-b px-4">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground h-7 gap-1.5 px-2 text-xs"
          onClick={() => navigate({ to: `/p/${projectId}/localization` })}
        >
          <ChevronLeft className="size-3.5" />
          목록
        </Button>

        <div className="bg-border h-4 w-px" />

        {/* Breadcrumb */}
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
          {item?.entityType ? (
            <>
              <span className="capitalize">{item.entityType}</span>
              <span className="text-muted-foreground/50">›</span>
            </>
          ) : null}
          <span className="text-foreground/80 font-medium">
            {item?.entityName ?? item?.title ?? item?.key ?? "번역 항목"}
          </span>
        </div>

        <div className="flex-1" />

        {/* Language pair */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="bg-muted rounded px-1.5 py-0.5 font-medium">KO</span>
          <span className="text-muted-foreground">→</span>
          <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 font-medium">
            {language?.code?.toUpperCase() ?? "EN"}
          </span>
        </div>

        {/* Auto-save indicator */}
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
          {updateMutation.isPending ? (
            <QuietLoadingIndicator className="text-xs" label="저장 중..." />
          ) : savedAt ? (
            <>
              <span className="size-1.5 rounded-full bg-green-500" />
              <span>자동 저장됨</span>
            </>
          ) : null}
        </div>
      </div>

      {/* ─── Toolbar ─── */}
      <div className="border-border flex h-10 shrink-0 items-center gap-3 border-b px-4">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            disabled={!hasPrev}
            onClick={handlePrev}
          >
            <ArrowLeft className="size-3.5" />
            이전
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            disabled={!hasNext}
            onClick={handleNext}
          >
            다음
            <ArrowRight className="size-3.5" />
          </Button>
        </div>

        {/* Progress */}
        {totalCount > 0 ? (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs tabular-nums">
              {currentIndex >= 0 ? currentIndex + 1 : "–"} / {totalCount}
            </span>
            <div className="bg-muted h-1.5 w-20 overflow-hidden rounded-full">
              <div
                className="bg-primary h-full rounded-full transition-all"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        ) : null}

        <div className="flex-1" />

        <Button variant="default" size="sm" className="h-7 gap-1.5 text-xs">
          <Sparkles className="size-3.5" />
          AI 번역
        </Button>
      </div>

      {/* ─── Split Editor ─── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — Source (read-only) */}
        <div className="border-border flex flex-1 flex-col overflow-hidden border-r">
          <div className="border-border bg-muted/10 flex h-9 shrink-0 items-center gap-2 border-b px-4">
            <Lock className="text-muted-foreground size-3.5" />
            <span className="text-muted-foreground text-xs font-medium">원문 (한국어)</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {translationLoading ? (
              <div className="space-y-4 p-5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-16 w-4/5" />
              </div>
            ) : sourceText ? (
              <div className="p-5">
                {item?.key ? (
                  <div className="text-muted-foreground/50 mb-2 font-mono text-2xs">
                    {item.key}
                  </div>
                ) : null}
                <div className="text-foreground/80 text-sm leading-relaxed whitespace-pre-wrap">
                  {sourceText}
                </div>
              </div>
            ) : (
              <EmptyPanel />
            )}
          </div>
        </div>

        {/* Right — Translation (editable) */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="border-border flex h-9 shrink-0 items-center gap-2 border-b bg-blue-50/30 px-4 dark:bg-blue-950/20">
            <span className="size-1.5 rounded-full bg-blue-500" />
            <span className="text-muted-foreground text-xs font-medium">
              번역 ({language?.name ?? "English"})
            </span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {translationLoading ? (
              <div className="space-y-4 p-5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : sourceText ? (
              <div className="p-5">
                {item?.key ? (
                  <div className="text-muted-foreground/50 mb-2 font-mono text-2xs">
                    {item.key}
                  </div>
                ) : null}
                <Textarea
                  value={targetText}
                  onChange={(e) => handleTextChange(e.target.value)}
                  placeholder="번역을 입력하세요..."
                  className={cn(
                    "min-h-32 w-full resize-none border-blue-200 bg-transparent text-sm leading-relaxed",
                    "focus-visible:ring-blue-300 dark:border-blue-800",
                  )}
                  rows={Math.max(5, Math.ceil((targetText.length || 20) / 40))}
                />
              </div>
            ) : (
              <EmptyPanel />
            )}
          </div>
        </div>

        {/* Glossary panel */}
        <EditorGlossaryPanel
          projectId={projectId}
          sourceText={sourceText}
          targetLanguageCode={language?.code ?? "en"}
        />
      </div>

      {/* ─── Footer Bar ─── */}
      <div className="border-border bg-muted/20 flex h-9 shrink-0 items-center gap-4 border-t px-4">
        <StatusBadge status={status} />

        <div className="bg-border h-3 w-px" />

        <span className="text-muted-foreground text-xs tabular-nums">
          원문 {charCountSource}자 · 번역 {charCountTarget}자
        </span>

        <div className="flex-1" />

        <span className="text-muted-foreground/60 text-xs">
          Ctrl+S 저장 · Alt+← → 이전/다음
        </span>
      </div>
    </div>
  );
}

/* Components */

function EmptyPanel() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <Languages className="text-muted-foreground/30 size-8" />
      <p className="text-muted-foreground text-sm">번역할 항목이 없습니다</p>
    </div>
  );
}
