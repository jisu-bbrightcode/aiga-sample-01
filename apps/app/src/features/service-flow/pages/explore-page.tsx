/**
 * 의사 탐색 (Explore) — the in-app service entry (PB-WEB-002 / BBR-580).
 *
 * Public/browsable WITHOUT login (online-service rule: 공개 탐색 가능), reading the
 * public catalog contract `/service/doctors?featured=true`. Each card carries a
 * gated save CTA: a logged-out visitor who acts is routed through sign-in and
 * returned here (AC#2). Loading / error / empty are all rendered explicitly.
 */

import { useFeatureTranslation } from "@repo/core/i18n";
import { Button } from "@repo/ui/shadcn/button";
import { AppQuietLoadingState } from "@/components/app-loading";
import { getAppErrorMessage } from "@/lib/user-facing-error";
import { DoctorExploreCard } from "../components/doctor-explore-card";
import { GatedSaveButton } from "../components/gated-save-button";
import { useFeaturedDoctors } from "../hooks/queries";

export function ExplorePage() {
  const { t } = useFeatureTranslation("app");
  const doctors = useFeaturedDoctors();
  const items = doctors.data?.items ?? [];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {t("serviceFlow.explore.title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("serviceFlow.explore.subtitle")}</p>
        </div>
        <GatedSaveButton
          label={t("serviceFlow.explore.openMyPage")}
          variant="default"
          size="default"
        />
      </header>

      <ExploreBody
        isLoading={doctors.isPending}
        isError={doctors.isError}
        error={doctors.error}
        isEmpty={items.length === 0}
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
  onRetry: () => void;
  children: React.ReactNode;
}

function ExploreBody({ isLoading, isError, error, isEmpty, onRetry, children }: ExploreBodyProps) {
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
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        {t("serviceFlow.explore.empty")}
      </p>
    );
  }

  return <>{children}</>;
}
