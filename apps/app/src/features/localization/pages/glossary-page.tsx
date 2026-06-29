/**
 * Full-page glossary management with table, category filter, and excel import/export.
 */

import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/shadcn/button";
import { Input } from "@repo/ui/shadcn/input";
import { Skeleton } from "@repo/ui/shadcn/skeleton";
import { useParams } from "@tanstack/react-router";
import { Download, Plus, Search, Upload } from "lucide-react";
import { useState } from "react";
import { GlossaryTable } from "../components/glossary-table";
import { useCreateGlossaryEntry } from "../hooks/use-localization-mutations";
import { useGlossary, useLanguages } from "../hooks/use-localization-queries";

const CATEGORIES = [
  { value: "all", label: "전체" },
  { value: "character", label: "캐릭터" },
  { value: "location", label: "장소" },
  { value: "faction", label: "세력" },
  { value: "item", label: "아이템" },
  { value: "general", label: "일반" },
] as const;

export function GlossaryPage() {
  const { projectId } = useParams({ strict: false }) as {
    projectId: string;
  };

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  const { data: glossaryData, isLoading: glossaryLoading } = useGlossary(
    projectId,
    search || undefined,
  );
  const { data: languagesData, isLoading: langLoading } = useLanguages(projectId);
  const createGlossary = useCreateGlossaryEntry(projectId);

  const entries = (glossaryData ?? []) as Array<{
    id: string;
    term: string;
    definition?: string;
    translations?: Array<{ languageCode: string; translation: string }>;
  }>;

  const languages = (languagesData ?? []) as Array<{
    id: string;
    code: string;
    name: string;
    isSource?: boolean;
  }>;
  const targetLangs = languages.filter((l) => !l.isSource);

  // TODO: category filter needs BE support — currently entries don't have a category field.
  // When BE adds category, filter here: entries.filter(e => activeCategory === "all" || e.category === activeCategory)
  const filteredEntries = entries;

  const handleAddEntry = () => {
    createGlossary.mutate({ term: "새 용어", definition: "", translations: [] });
  };

  const handleExcelDownload = () => {};

  const handleExcelUpload = () => {};

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="px-6 pb-0 pt-5">
        <h1 className="text-lg font-semibold text-foreground">용어 사전</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          고유 명사를 등록하면 AI 번역 시 일관된 용어를 사용합니다
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-border px-6 py-3">
        {/* Search */}
        <div className="relative w-[240px]">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="용어 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-9 text-sm"
          />
        </div>

        {/* Category filter */}
        <div className="flex gap-1">
          {CATEGORIES.map((cat) => (
            <Button
              key={cat.value}
              variant="outline"
              size="sm"
              className={cn(
                "h-7 px-3 text-xs",
                activeCategory === cat.value
                  ? "border-foreground bg-foreground text-background hover:bg-foreground/90 hover:text-background"
                  : "",
              )}
              onClick={() => setActiveCategory(cat.value)}
            >
              {cat.label}
            </Button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Right-side actions */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={handleExcelDownload}
        >
          <Download className="size-3.5" />
          엑셀 다운로드
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={handleExcelUpload}
        >
          <Upload className="size-3.5" />
          엑셀 업로드
        </Button>
        <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={handleAddEntry}>
          <Plus className="size-3.5" />
          용어 추가
        </Button>
      </div>

      {/* Content */}
      {glossaryLoading || langLoading ? (
        <GlossarySkeletons />
      ) : (
        <GlossaryTable entries={filteredEntries} languages={targetLangs} />
      )}

      {/* Footer summary */}
      <GlossaryFooter entries={entries} targetLangs={targetLangs} />
    </div>
  );
}

/* Components */

function GlossarySkeletons() {
  return (
    <div className="flex-1 px-6 py-4">
      <div className="space-y-2">
        <Skeleton className="h-8 w-full rounded" />
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded" />
        ))}
      </div>
    </div>
  );
}

interface GlossaryFooterProps {
  entries: Array<{
    id: string;
    translations?: Array<{ languageCode: string; translation: string }>;
  }>;
  targetLangs: Array<{ id: string; code: string; name: string }>;
}

function GlossaryFooter({ entries, targetLangs }: GlossaryFooterProps) {
  const total = entries.length;

  const langStats = targetLangs.map((lang) => {
    const translated = entries.filter((e) =>
      (e.translations ?? []).some((t) => t.languageCode === lang.code && t.translation),
    ).length;
    const pct = total > 0 ? Math.round((translated / total) * 100) : 0;
    return { code: lang.code.toUpperCase(), translated, pct };
  });

  return (
    <div className="flex items-center gap-4 border-t border-border bg-muted/30 px-6 py-2.5 text-xs text-muted-foreground">
      <span>총 {total}개 용어</span>
      {langStats.map((stat) => (
        <span key={stat.code}>
          · {stat.code} {stat.translated}개 번역됨 ({stat.pct}%)
        </span>
      ))}
    </div>
  );
}
