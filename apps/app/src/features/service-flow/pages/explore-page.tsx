/**
 * 의사 탐색 (Explore) — the in-app service entry (PB-WEB-002 / BBR-580, FR-002 / BBR-729).
 *
 * Public/browsable WITHOUT login (online-service rule: 공개 탐색 가능), reading the
 * public catalog contract `/service/doctors`. FR-004 (BBR-583) adds 명의 찾기
 * 검색·필터·정렬: a keyword search plus 진료과 / 지역 filters and a sort selector,
 * all held in the URL so the view is shareable and a 검색 히스토리 entry can
 * re-run it. Each card carries gated 저장/관심 CTAs: a logged-out visitor who acts
 * is routed through sign-in and returned here, where {@link usePendingIntentReplay}
 * completes the attempted action (AC: 원래 액션 자동 복귀). Loading / error / empty
 * (and filtered-empty) states render explicitly.
 */

import { useFeatureTranslation } from "@repo/core/i18n";
import { Button } from "@repo/ui/shadcn/button";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { AppQuietLoadingState } from "@/components/app-loading";
import { getAppErrorMessage } from "@/lib/user-facing-error";
import { DoctorExploreCard } from "../components/doctor-explore-card";
import { DoctorSearchControls } from "../components/doctor-search-controls";
import { GatedSaveButton } from "../components/gated-save-button";
import { useDoctorSearch, useRegions, useSpecialties } from "../hooks/queries";
import { usePendingIntentReplay } from "../hooks/use-pending-intent-replay";
import {
  type DoctorSearchFilters,
  hasActiveSearch,
  parseDoctorSearch,
  type RawDoctorSearch,
  toDoctorSearchParams,
} from "../lib/doctor-search-params";

export function ExplorePage() {
  const { t } = useFeatureTranslation("app");
  const navigate = useNavigate();

  // The full 검색·필터·정렬 state lives in the URL (shareable + history re-run).
  const filters = parseDoctorSearch(useSearch({ strict: false }) as RawDoctorSearch);

  // 원래 액션 자동 복귀: replay a save/interest attempted before login (return-to-intent).
  usePendingIntentReplay();

  const specialties = useSpecialties();
  const regions = useRegions();
  const doctors = useDoctorSearch(filters);
  const items = doctors.data?.items ?? [];

  function applyFilters(next: DoctorSearchFilters) {
    navigate({ to: "/explore", search: toDoctorSearchParams(next) } as never);
  }

  const isFiltered = hasActiveSearch(filters);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {t("serviceFlow.explore.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {filters.q
              ? t("serviceFlow.explore.searchResultsFor", { query: filters.q })
              : t("serviceFlow.explore.subtitle")}
          </p>
        </div>
        <GatedSaveButton
          label={t("serviceFlow.explore.openMyPage")}
          variant="default"
          size="default"
        />
      </header>

      <DoctorSearchControls
        filters={filters}
        specialties={specialties.data ?? []}
        regions={regions.data ?? []}
        taxonomyLoading={specialties.isPending || regions.isPending}
        onChange={applyFilters}
      />

      <ExploreBody
        isLoading={doctors.isPending}
        isError={doctors.isError}
        error={doctors.error}
        isEmpty={items.length === 0}
        emptyMessage={
          isFiltered ? t("serviceFlow.explore.filteredEmpty") : t("serviceFlow.explore.empty")
        }
        onRetry={() => void doctors.refetch()}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((doctor) => (
            <DoctorExploreCard key={doctor.id} doctor={doctor} />
          ))}
        </div>
      </ExploreBody>
    </div>
  );
}

interface ExploreBodyProps {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  isEmpty: boolean;
  emptyMessage: string;
  onRetry: () => void;
  children: React.ReactNode;
}

function ExploreBody({
  isLoading,
  isError,
  error,
  isEmpty,
  emptyMessage,
  onRetry,
  children,
}: ExploreBodyProps) {
  const { t } = useFeatureTranslation("app");

  if (isLoading) {
    return <AppQuietLoadingState label={t("serviceFlow.states.loading")} variant="page" />;
  }

  if (isError) {
    return (
      <div
        className="flex flex-col items-center gap-3 py-12 text-center text-sm text-muted-foreground"
        role="alert"
      >
        <p>{getAppErrorMessage(t, error)}</p>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          {t("serviceFlow.actions.retry")}
        </Button>
      </div>
    );
  }

  if (isEmpty) {
    return <p className="py-12 text-center text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return <>{children}</>;
}
