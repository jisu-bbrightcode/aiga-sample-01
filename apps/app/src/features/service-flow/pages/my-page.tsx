/**
 * 내 페이지 (My Page) — the logged-in user's service hub (PB-WEB-002 / BBR-580).
 *
 * Reached only through {@link RequireAuth}, so this renders for an authenticated
 * user. The profile header reads the hydrated session; the three sections wire
 * the user's core service state to the merged personalization contracts
 * (saved-items / interests / search-history), each branching its own
 * loading / error / 권한 없음 / empty state via {@link ServiceSection}.
 */

import { useFeatureTranslation } from "@repo/core/i18n";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/shadcn/avatar";
import { Button } from "@repo/ui/shadcn/button";
import { useNavigate } from "@tanstack/react-router";
import { Compass } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import {
  InterestsList,
  SavedItemsList,
  SearchHistoryList,
} from "../components/personalization-lists";
import { ServiceSection } from "../components/service-section";
import { useInterests, useSavedItems, useSearchHistory } from "../hooks/queries";

export function MyPage() {
  const { t } = useFeatureTranslation("app");
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const user = session?.user;

  const saved = useSavedItems(true);
  const interests = useInterests(true);
  const history = useSearchHistory(true);

  const displayName = user?.name?.trim() || user?.email || t("serviceFlow.myPage.fallbackName");
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Avatar className="size-12">
            {user?.image ? <AvatarImage src={user.image} alt="" /> : null}
            <AvatarFallback>{initial}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-foreground">
              {t("serviceFlow.myPage.greeting", { name: displayName })}
            </h1>
            {user?.email ? (
              <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            ) : null}
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-none gap-1.5"
          onClick={() => navigate({ to: "/explore" })}
          data-el="service-flow.my-page.explore-link"
        >
          <Compass className="size-3.5" />
          {t("serviceFlow.myPage.explore")}
        </Button>
      </header>

      <ServiceSection
        title={t("serviceFlow.saved.title")}
        description={t("serviceFlow.saved.description")}
        isLoading={saved.isPending}
        isError={saved.isError}
        error={saved.error}
        isEmpty={(saved.data?.items.length ?? 0) === 0}
        emptyMessage={t("serviceFlow.saved.empty")}
        onRetry={() => void saved.refetch()}
      >
        {saved.data ? <SavedItemsList items={saved.data.items} /> : null}
      </ServiceSection>

      <ServiceSection
        title={t("serviceFlow.interests.title")}
        description={t("serviceFlow.interests.description")}
        isLoading={interests.isPending}
        isError={interests.isError}
        error={interests.error}
        isEmpty={(interests.data?.items.length ?? 0) === 0}
        emptyMessage={t("serviceFlow.interests.empty")}
        onRetry={() => void interests.refetch()}
      >
        {interests.data ? <InterestsList items={interests.data.items} /> : null}
      </ServiceSection>

      <ServiceSection
        title={t("serviceFlow.history.title")}
        description={t("serviceFlow.history.description")}
        isLoading={history.isPending}
        isError={history.isError}
        error={history.error}
        isEmpty={(history.data?.items.length ?? 0) === 0}
        emptyMessage={t("serviceFlow.history.empty")}
        onRetry={() => void history.refetch()}
      >
        {history.data ? <SearchHistoryList items={history.data.items} /> : null}
      </ServiceSection>
    </div>
  );
}
