/**
 * 통합검색 result card — FR-003 / BBR-582.
 *
 * Renders one public search hit (`PublicSearchHit`) from `GET /service/search`.
 * A hit can be a doctor / hospital / specialty / region, so the card is
 * type-agnostic: a type badge, a title + subtitle, an optional thumbnail, and a
 * rating when present. Browsable logged-out — the card is read-only (no gated
 * action) because a hit is not always a save target (specialty/region are not).
 */

import { useFeatureTranslation } from "@repo/core/i18n";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/shadcn/avatar";
import { Badge } from "@repo/ui/shadcn/badge";
import { Star } from "lucide-react";
import type { PublicSearchHit } from "../api/unified-search-types";

export function SearchResultCard({ hit }: { hit: PublicSearchHit }) {
  const { t } = useFeatureTranslation("app");
  const initial = (hit.title.trim().charAt(0) || "?").toUpperCase();
  const hasRating = hit.ratingAvg > 0;

  return (
    <article
      className="flex items-start gap-3 rounded-xl border border-border bg-card p-4"
      data-el="service-flow.search-result-card"
    >
      <Avatar className="size-12">
        {hit.photoUrl ? <AvatarImage src={hit.photoUrl} alt="" /> : null}
        <AvatarFallback>{initial}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{t(`serviceFlow.unifiedSearch.type.${hit.entityType}`)}</Badge>
          {hasRating ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Star className="size-3 fill-current text-amber-500" aria-hidden />
              {hit.ratingAvg.toFixed(1)}
            </span>
          ) : null}
        </div>
        <h3 className="mt-1 truncate text-base font-semibold text-foreground">{hit.title}</h3>
        {hit.subtitle ? (
          <p className="truncate text-sm text-muted-foreground">{hit.subtitle}</p>
        ) : null}
      </div>
    </article>
  );
}
