/**
 * Glossary table with sticky header, zebra striping, language columns.
 */
import { cn } from "@repo/ui/lib/utils";

interface GlossaryEntry {
  id: string;
  term: string;
  definition?: string;
  translations?: Array<{ languageCode: string; translation: string }>;
}

interface GlossaryTableProps {
  entries: GlossaryEntry[];
  languages: Array<{ id: string; code: string; name: string }>;
  onUpdateEntry?: (id: string, field: string, value: string) => void;
  onDeleteEntry?: (id: string) => void;
}

export function GlossaryTable({
  entries,
  languages,
  onUpdateEntry: _onUpdateEntry,
  onDeleteEntry: _onDeleteEntry,
}: GlossaryTableProps) {
  const visibleLangs = languages.slice(0, 5);

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10">
          <tr>
            <th className="w-[160px] border-b border-border bg-muted/50 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              원어
            </th>
            <th className="border-b border-border bg-muted/50 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              정의
            </th>
            {visibleLangs.map((lang) => (
              <th
                key={lang.id}
                className="w-[140px] border-b border-border bg-muted/50 px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                {lang.code.toUpperCase()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, i) => {
            const tMap = new Map(
              (entry.translations ?? []).map((t) => [t.languageCode, t.translation]),
            );

            return (
              <tr
                key={entry.id}
                className={cn(
                  "transition-colors hover:bg-muted",
                  i % 2 === 0 ? "bg-background" : "bg-muted/10",
                )}
              >
                <td className="border-b border-border/50 px-4 py-3">
                  <span className="font-semibold text-foreground">{entry.term}</span>
                  {/* Category badge — show if entry has a category field (future BE support) */}
                </td>
                <td className="max-w-[200px] truncate border-b border-border/50 px-4 py-3 text-muted-foreground">
                  {entry.definition || "—"}
                </td>
                {visibleLangs.map((lang) => {
                  const value = tMap.get(lang.code);
                  return (
                    <td key={lang.id} className="border-b border-border/50 px-4 py-3 text-center">
                      {value ? (
                        <span className="text-foreground">{value}</span>
                      ) : (
                        <span className="text-muted-foreground/30">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            아리아, 카엘, 아르테미아... 세계의 이름을 등록하세요.
          </p>
        </div>
      ) : null}
    </div>
  );
}

/* Constants — category badge styles (prepared for future use when BE supports category) */

export const CATEGORY_BADGES: Record<string, string> = {
  character: "bg-pink-100 text-pink-700",
  location: "bg-indigo-100 text-indigo-700",
  faction: "bg-amber-100 text-amber-700",
  item: "bg-emerald-100 text-emerald-700",
  general: "bg-gray-100 text-gray-600",
};

export const CATEGORY_LABELS: Record<string, string> = {
  character: "캐릭터",
  location: "장소",
  faction: "세력",
  item: "아이템",
  general: "일반",
};
