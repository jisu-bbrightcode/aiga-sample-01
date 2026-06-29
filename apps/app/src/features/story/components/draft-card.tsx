/**
 * Draft memo-card: stacked paper effect (memo-card-wrap pattern).
 * Structure: title (13px semibold) + description preview (13px, 4-line clamp) + time (12px muted).
 * Card: bg surface, border border, rounded 12px, padding md, min-height 140px.
 * Hover: translateY(-1px), box-shadow.
 */
import { useFeatureTranslation } from "@repo/core/i18n";
import { MemoCard } from "../layouts/memo-card";

type TFn = (key: string, options?: Record<string, unknown>) => string;

interface Props {
  id: string;
  title: string;
  description?: string | null;
  updatedAt?: string | Date | null;
  onClick?: () => void;
  dataEl?: string;
}

export function DraftCard({ title, description, updatedAt, onClick, dataEl }: Props) {
  const { t } = useFeatureTranslation("feature.story");
  return (
    <MemoCard data-el={dataEl} onClick={onClick}>
      <div className="flex min-h-[108px] flex-col">
        {/* Title */}
        <div className="mb-1.5 text-base font-semibold text-foreground">{title}</div>

        {/* Description preview — 4-line clamp */}
        {description ? (
          <div className="flex-1 text-base leading-normal text-muted-foreground line-clamp-4">
            {description}
          </div>
        ) : (
          <div className="flex-1 text-base italic text-muted-foreground/50">
            {t("draft.card.noDescription")}
          </div>
        )}

        {/* Relative time */}
        {updatedAt ? (
          <div className="mt-sm text-xs text-muted-foreground">
            {formatRelativeTime(updatedAt, t)}
          </div>
        ) : null}
      </div>
    </MemoCard>
  );
}

/* Helpers */

function formatRelativeTime(date: string | Date | null, t: TFn): string {
  if (!date) return "";
  const now = Date.now();
  const d = typeof date === "string" ? new Date(date).getTime() : date.getTime();
  const diff = now - d;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  const weeks = Math.floor(days / 7);

  if (minutes < 1) return t("draft.listItem.justNow");
  if (minutes < 60) return t("draft.listItem.minutesAgo", { count: minutes });
  if (hours < 24) return t("draft.listItem.hoursAgo", { count: hours });
  if (days === 1) return t("draft.listItem.yesterday");
  if (days < 7) return t("draft.listItem.daysAgo", { count: days });
  if (weeks < 5) return t("draft.listItem.weeksAgo", { count: weeks });
  return new Date(d).toLocaleDateString("ko-KR");
}
