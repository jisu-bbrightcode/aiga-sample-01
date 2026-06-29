import { Skeleton } from "@repo/ui/shadcn/skeleton";
import { BookOpen } from "lucide-react";
import { useGlossary } from "../hooks/use-localization-queries";

interface EditorGlossaryPanelProps {
  projectId: string;
  sourceText: string;
  targetLanguageCode: string;
}

export function EditorGlossaryPanel({
  projectId,
  sourceText,
  targetLanguageCode,
}: EditorGlossaryPanelProps) {
  const { data: glossary, isLoading } = useGlossary(projectId);

  const entries = (glossary ?? []) as Array<{
    id: string;
    term: string;
    translation?: string;
    definition?: string;
    languageCode?: string;
  }>;

  const matched = entries.filter((entry) =>
    sourceText.toLowerCase().includes(entry.term.toLowerCase()),
  );

  return (
    <div className="flex w-60 shrink-0 flex-col border-l border-border bg-muted/20">
      {/* Header */}
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
        <BookOpen className="size-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">관련 용어</span>
        {matched.length > 0 ? (
          <span className="ml-auto rounded-full bg-primary/10 px-1.5 py-0.5 text-2xs font-medium text-primary">
            {matched.length}
          </span>
        ) : null}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-3 p-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>
        ) : matched.length > 0 ? (
          <div className="divide-y divide-border">
            {matched.map((entry) => (
              <div key={entry.id} className="px-3 py-2.5">
                <div className="text-xs font-semibold text-foreground">{entry.term}</div>
                {entry.translation ? (
                  <div className="mt-0.5 text-xs text-blue-600">→ {entry.translation}</div>
                ) : null}
                {entry.definition ? (
                  <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {entry.definition}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 px-3 py-8">
            <BookOpen className="size-5 text-muted-foreground/30" />
            <p className="text-center text-xs text-muted-foreground">
              원문에서 매칭되는
              <br />
              용어가 없습니다
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
