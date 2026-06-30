/**
 * 통합검색 controls — FR-003 / BBR-582.
 *
 * A controlled bar over the public unified-search query: a keyword search
 * (committed on submit so typing does not fire a request per keystroke), an
 * entity-type filter, and a sort selector. Every control maps to a real
 * `GET /service/search` query param via the parent's `onChange` — there is no
 * client-only ordering, so the rendered state always matches the API contract.
 */

import { useFeatureTranslation } from "@repo/core/i18n";
import { Button } from "@repo/ui/shadcn/button";
import { Input } from "@repo/ui/shadcn/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/shadcn/select";
import { Search } from "lucide-react";
import { useEffect, useId, useState } from "react";
import type { SearchEntityType } from "../api/unified-search-types";
import {
  DEFAULT_UNIFIED_SORT,
  hasActiveSearch,
  SEARCH_ENTITY_TYPES,
  type UnifiedSearchFilters,
  type UnifiedSortKey,
} from "../lib/unified-search-params";

/** Select sentinel for "no filter" — base-ui Select cannot hold an empty value. */
const ALL = "all";

interface UnifiedSearchControlsProps {
  filters: UnifiedSearchFilters;
  onChange: (next: UnifiedSearchFilters) => void;
}

export function UnifiedSearchControls({ filters, onChange }: UnifiedSearchControlsProps) {
  const { t } = useFeatureTranslation("app");
  const keywordId = useId();

  // The keyword is locally controlled and only committed on submit; selects
  // commit immediately. Sync the draft when the URL keyword changes externally
  // (e.g. a 인기/최근 검색어 chip navigates here with a new `q`).
  const [keyword, setKeyword] = useState(filters.q ?? "");
  useEffect(() => {
    setKeyword(filters.q ?? "");
  }, [filters.q]);

  function submitKeyword(event: React.FormEvent) {
    event.preventDefault();
    const next = keyword.trim();
    onChange({ ...filters, q: next === "" ? undefined : next });
  }

  function selectType(value: string) {
    onChange({ ...filters, type: value === ALL ? undefined : (value as SearchEntityType) });
  }

  function selectSort(value: string) {
    onChange({ ...filters, sort: value as UnifiedSortKey });
  }

  function reset() {
    setKeyword("");
    onChange({ sort: DEFAULT_UNIFIED_SORT });
  }

  const showReset = hasActiveSearch(filters) || filters.sort !== DEFAULT_UNIFIED_SORT;

  return (
    <div className="flex flex-col gap-3" data-el="service-flow.unified-search-controls">
      <form onSubmit={submitKeyword} className="flex gap-2">
        <label htmlFor={keywordId} className="sr-only">
          {t("serviceFlow.unifiedSearch.keywordLabel")}
        </label>
        <Input
          id={keywordId}
          type="search"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder={t("serviceFlow.unifiedSearch.keywordPlaceholder")}
          className="flex-1"
        />
        <Button type="submit" variant="default">
          <Search className="size-4" aria-hidden />
          <span>{t("serviceFlow.unifiedSearch.submit")}</span>
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={filters.type ?? ALL} onValueChange={(v) => v && selectType(v)}>
          <SelectTrigger aria-label={t("serviceFlow.unifiedSearch.typeLabel")} className="w-40">
            <SelectValue placeholder={t("serviceFlow.unifiedSearch.typeLabel")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("serviceFlow.unifiedSearch.typeAll")}</SelectItem>
            {SEARCH_ENTITY_TYPES.map((entityType) => (
              <SelectItem key={entityType} value={entityType}>
                {t(`serviceFlow.unifiedSearch.type.${entityType}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.sort} onValueChange={(v) => v && selectSort(v)}>
          <SelectTrigger aria-label={t("serviceFlow.unifiedSearch.sortLabel")} className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="relevance">
              {t("serviceFlow.unifiedSearch.sortRelevance")}
            </SelectItem>
            <SelectItem value="rating">{t("serviceFlow.unifiedSearch.sortRating")}</SelectItem>
          </SelectContent>
        </Select>

        {showReset ? (
          <Button type="button" variant="ghost" size="sm" onClick={reset}>
            {t("serviceFlow.unifiedSearch.reset")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
