/**
 * 명의 찾기 검색·필터·정렬 controls (FR-004 / BBR-583).
 *
 * A controlled bar over the public catalog query: a keyword search (committed on
 * submit so typing does not fire a request per keystroke), 진료과 / 지역 filters,
 * and a sort selector. Every control maps to a real `/service/doctors` query
 * param via the parent's `onChange` — there is no client-only ordering.
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
import type { PublicRegion, PublicSpecialty } from "../api/types";
import {
  DEFAULT_DOCTOR_SORT,
  type DoctorSearchFilters,
  type DoctorSortKey,
  hasActiveSearch,
} from "../lib/doctor-search-params";

/** Select sentinel for "no filter" — base-ui Select cannot hold an empty value. */
const ALL = "all";

interface DoctorSearchControlsProps {
  filters: DoctorSearchFilters;
  specialties: PublicSpecialty[];
  regions: PublicRegion[];
  /** Filters loading — disables the selects while taxonomy is in flight. */
  taxonomyLoading?: boolean;
  onChange: (next: DoctorSearchFilters) => void;
}

export function DoctorSearchControls({
  filters,
  specialties,
  regions,
  taxonomyLoading = false,
  onChange,
}: DoctorSearchControlsProps) {
  const { t } = useFeatureTranslation("app");
  const keywordId = useId();

  // The keyword is locally controlled and only committed on submit; selects
  // commit immediately. Sync the draft when the URL keyword changes externally
  // (e.g. a 검색 히스토리 재실행 navigates here with a new `q`).
  const [keyword, setKeyword] = useState(filters.q ?? "");
  useEffect(() => {
    setKeyword(filters.q ?? "");
  }, [filters.q]);

  function submitKeyword(event: React.FormEvent) {
    event.preventDefault();
    const next = keyword.trim();
    onChange({ ...filters, q: next === "" ? undefined : next });
  }

  function selectSpecialty(value: string) {
    onChange({ ...filters, specialtyId: value === ALL ? undefined : value });
  }

  function selectRegion(value: string) {
    onChange({ ...filters, regionId: value === ALL ? undefined : value });
  }

  function selectSort(value: string) {
    onChange({ ...filters, sort: value as DoctorSortKey });
  }

  function reset() {
    setKeyword("");
    onChange({ sort: DEFAULT_DOCTOR_SORT });
  }

  const showReset = hasActiveSearch(filters) || filters.sort !== DEFAULT_DOCTOR_SORT;

  return (
    <div className="flex flex-col gap-3" data-el="service-flow.search-controls">
      <form onSubmit={submitKeyword} className="flex gap-2">
        <label htmlFor={keywordId} className="sr-only">
          {t("serviceFlow.search.keywordLabel")}
        </label>
        <Input
          id={keywordId}
          type="search"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder={t("serviceFlow.search.keywordPlaceholder")}
          className="flex-1"
        />
        <Button type="submit" variant="default">
          <Search className="size-4" aria-hidden />
          <span>{t("serviceFlow.search.submit")}</span>
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={filters.specialtyId ?? ALL}
          onValueChange={(v) => v && selectSpecialty(v)}
          disabled={taxonomyLoading}
        >
          <SelectTrigger aria-label={t("serviceFlow.search.specialtyLabel")} className="w-40">
            <SelectValue placeholder={t("serviceFlow.search.specialtyLabel")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("serviceFlow.search.specialtyAll")}</SelectItem>
            {specialties.map((specialty) => (
              <SelectItem key={specialty.id} value={specialty.id}>
                {specialty.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.regionId ?? ALL}
          onValueChange={(v) => v && selectRegion(v)}
          disabled={taxonomyLoading}
        >
          <SelectTrigger aria-label={t("serviceFlow.search.regionLabel")} className="w-40">
            <SelectValue placeholder={t("serviceFlow.search.regionLabel")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("serviceFlow.search.regionAll")}</SelectItem>
            {regions.map((region) => (
              <SelectItem key={region.id} value={region.id}>
                {region.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.sort} onValueChange={(v) => v && selectSort(v)}>
          <SelectTrigger aria-label={t("serviceFlow.search.sortLabel")} className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recommended">{t("serviceFlow.search.sortRecommended")}</SelectItem>
            <SelectItem value="rating">{t("serviceFlow.search.sortRating")}</SelectItem>
          </SelectContent>
        </Select>

        {showReset ? (
          <Button type="button" variant="ghost" size="sm" onClick={reset}>
            {t("serviceFlow.search.reset")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
