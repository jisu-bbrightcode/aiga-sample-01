/**
 * Presentational list rows for the My Page personalization sections
 * (PB-WEB-002 / BBR-580, FR-002 / BBR-729). Each renders one merged
 * personalization contract (saved-items / interests / search-history) — pure
 * props in, no fetching. The owning page supplies the action callbacks:
 *  - saved/interest rows carry a 해제(remove) control → `onRemove(id)`,
 *  - search-history rows carry a 재실행(re-run) control → `onRerun(entry)`.
 *
 * Saved/interest rows show the catalog target type + the user's own metadata.
 * Resolving a `targetId` to its doctor/hospital name needs a by-id catalog
 * lookup the public API does not expose yet (only by-slug), so names are a
 * documented follow-up; the row still surfaces the user's saved memo/tags/date.
 */

import { useFeatureTranslation } from "@repo/core/i18n";
import { Badge } from "@repo/ui/shadcn/badge";
import { Button } from "@repo/ui/shadcn/button";
import { RotateCcw, X } from "lucide-react";
import type { Interest, SavedItem, SearchHistoryEntry, ServiceTargetType } from "../api/types";
import { formatServiceDate } from "../lib/format-date";

function useTargetTypeLabel(): (type: ServiceTargetType) => string {
  const { t } = useFeatureTranslation("app");
  return (type) =>
    type === "doctor" ? t("serviceFlow.target.doctor") : t("serviceFlow.target.hospital");
}

interface SavedItemsListProps {
  items: SavedItem[];
  onRemove: (id: string) => void;
  /** id currently being removed (disables that row's control). */
  removingId?: string | null;
}

export function SavedItemsList({ items, onRemove, removingId }: SavedItemsListProps) {
  const { t } = useFeatureTranslation("app");
  const targetLabel = useTargetTypeLabel();
  return (
    <ul className="flex flex-col gap-2" data-el="service-flow.saved-list">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex flex-col gap-1.5 rounded-lg border border-border/60 px-3 py-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <Badge variant="secondary">{targetLabel(item.targetType)}</Badge>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {formatServiceDate(item.createdAt)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs text-muted-foreground"
                onClick={() => onRemove(item.id)}
                disabled={removingId === item.id}
                aria-label={t("serviceFlow.actions.removeSaved")}
                data-el="service-flow.saved-remove"
              >
                <X className="size-3.5" />
                {t("serviceFlow.actions.remove")}
              </Button>
            </div>
          </div>
          {item.memo ? <p className="text-sm text-foreground">{item.memo}</p> : null}
          {item.tags && item.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {item.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                >
                  #{tag}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{t("serviceFlow.saved.noMemo")}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

interface InterestsListProps {
  items: Interest[];
  onRemove: (id: string) => void;
  removingId?: string | null;
}

export function InterestsList({ items, onRemove, removingId }: InterestsListProps) {
  const { t } = useFeatureTranslation("app");
  const targetLabel = useTargetTypeLabel();
  return (
    <ul className="flex flex-wrap gap-2" data-el="service-flow.interests-list">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex items-center gap-2 rounded-lg border border-border/60 py-1.5 pl-3 pr-1.5"
        >
          <Badge variant="outline">{targetLabel(item.targetType)}</Badge>
          <span className="text-xs text-muted-foreground">{formatServiceDate(item.createdAt)}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="size-7 p-0 text-muted-foreground"
            onClick={() => onRemove(item.id)}
            disabled={removingId === item.id}
            aria-label={t("serviceFlow.actions.removeInterest")}
            data-el="service-flow.interest-remove"
          >
            <X className="size-3.5" />
          </Button>
        </li>
      ))}
    </ul>
  );
}

interface SearchHistoryListProps {
  items: SearchHistoryEntry[];
  /** Re-run a recent search (최근 검색 재실행). */
  onRerun: (entry: SearchHistoryEntry) => void;
}

export function SearchHistoryList({ items, onRerun }: SearchHistoryListProps) {
  const { t } = useFeatureTranslation("app");
  return (
    <ul className="flex flex-col gap-1.5" data-el="service-flow.history-list">
      {items.map((item) => {
        const isFilterOnly = item.query.trim() === "";
        return (
          <li key={item.id}>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onRerun(item)}
              disabled={isFilterOnly}
              className="flex h-auto w-full items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2 text-left font-normal"
              data-el="service-flow.history-rerun"
            >
              <span className="truncate text-sm text-foreground">
                {isFilterOnly ? t("serviceFlow.history.filterOnly") : item.query}
              </span>
              <span className="flex flex-none items-center gap-1.5 text-xs text-muted-foreground">
                {formatServiceDate(item.createdAt)}
                {isFilterOnly ? null : <RotateCcw className="size-3.5" aria-hidden />}
              </span>
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
