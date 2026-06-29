import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/shadcn/button";

type StatusFilter = "all" | "pending" | "translated" | "approved";

interface TranslationToolbarProps {
  languages: Array<{ id: string; code: string; name: string }>;
  selectedLanguageId: string;
  onLanguageChange: (langId: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (status: StatusFilter) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onAiBatchTranslate?: () => void;
  isAiTranslating?: boolean;
}

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "전체" },
  { value: "pending", label: "미번역" },
  { value: "translated", label: "진행중" },
  { value: "approved", label: "완료" },
];

export function TranslationToolbar({
  languages,
  selectedLanguageId,
  onLanguageChange,
  statusFilter,
  onStatusFilterChange,
  searchQuery,
  onSearchChange,
  onAiBatchTranslate,
  isAiTranslating,
}: TranslationToolbarProps) {
  return (
    <div className="px-5 pb-4">
      {/* Filters row */}
      <div className="flex items-center gap-3">
        {/* Language pills */}
        <div className="flex items-center gap-1">
          {languages.map((lang) => (
            <button
              key={lang.id}
              type="button"
              className={cn(
                "h-8 rounded-lg px-3 text-sm transition-colors",
                selectedLanguageId === lang.id
                  ? "bg-primary font-medium text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              onClick={() => onLanguageChange(lang.id)}
            >
              {lang.code.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="h-4 w-px bg-border/50" />

        {/* Status filter */}
        <div className="flex items-center gap-1">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={cn(
                "h-8 rounded-lg px-3 text-sm transition-colors",
                statusFilter === opt.value
                  ? "bg-primary font-medium text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              onClick={() => onStatusFilterChange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <span className="ml-auto text-xs text-muted-foreground/50">
          {/* count injected by parent */}
        </span>

        {/* AI batch translate — optional */}
        {onAiBatchTranslate ? (
          <Button
            size="sm"
            className="h-8 gap-1.5 rounded-lg text-sm"
            onClick={onAiBatchTranslate}
            disabled={isAiTranslating}
          >
            ✨ AI 일괄 번역
          </Button>
        ) : null}
      </div>
    </div>
  );
}
