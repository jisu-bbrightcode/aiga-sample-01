/**
 * Presentational list rows for the My Page personalization sections
 * (PB-WEB-002 / BBR-580). Each renders one merged personalization contract
 * (saved-items / interests / search-history) — pure props in, no fetching.
 *
 * Saved/interest rows show the catalog target type + the user's own metadata.
 * Resolving a `targetId` to its doctor/hospital name needs a by-id catalog
 * lookup the public API does not expose yet (only by-slug), so names are a
 * documented follow-up; the row still surfaces the user's saved memo/tags/date.
 */

import { useFeatureTranslation } from "@repo/core/i18n";
import { Badge } from "@repo/ui/shadcn/badge";
import type { Interest, SavedItem, SearchHistoryEntry, ServiceTargetType } from "../api/types";
import { formatServiceDate } from "../lib/format-date";

function useTargetTypeLabel(): (type: ServiceTargetType) => string {
  const { t } = useFeatureTranslation("app");
  return (type) =>
    type === "doctor" ? t("serviceFlow.target.doctor") : t("serviceFlow.target.hospital");
}

export function SavedItemsList({ items }: { items: SavedItem[] }) {
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
            <span className="text-xs text-muted-foreground">
              {formatServiceDate(item.createdAt)}
            </span>
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

export function InterestsList({ items }: { items: Interest[] }) {
  const targetLabel = useTargetTypeLabel();
  return (
    <ul className="flex flex-wrap gap-2" data-el="service-flow.interests-list">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-1.5"
        >
          <Badge variant="outline">{targetLabel(item.targetType)}</Badge>
          <span className="text-xs text-muted-foreground">{formatServiceDate(item.createdAt)}</span>
        </li>
      ))}
    </ul>
  );
}

export function SearchHistoryList({ items }: { items: SearchHistoryEntry[] }) {
  const { t } = useFeatureTranslation("app");
  return (
    <ul className="flex flex-col gap-1.5" data-el="service-flow.history-list">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2"
        >
          <span className="truncate text-sm text-foreground">
            {item.query.trim() === "" ? t("serviceFlow.history.filterOnly") : item.query}
          </span>
          <span className="flex-none text-xs text-muted-foreground">
            {formatServiceDate(item.createdAt)}
          </span>
        </li>
      ))}
    </ul>
  );
}
