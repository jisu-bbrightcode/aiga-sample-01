/**
 * 통합 검색 (Unified Search) — FR-003 / BBR-582.
 *
 * The in-app unified search over the published catalog (의사/병원/진료과/지역),
 * reading the public contract `GET /service/search`. Public/browsable WITHOUT
 * login (online-service rule: 공개 탐색 가능). Search state lives in the URL so it
 * is shareable and re-runnable from a 인기/최근 검색어 chip.
 *
 * State branching (AC: 로그인/권한 상태에 따라 화면 분기):
 *  - results + 인기 검색어 are public — loading / error / empty / ready render explicitly.
 *  - 최근 검색어 is auth-gated: signed-in → the user's own history; signed-out →
 *    a 로그인 안내 (권한 없음) branch; session-hydrating → a quiet loading line.
 *
 * Every control maps to a real server query param, so the rendered state always
 * matches the API contract (AC: API contract와 UI 상태 일관).
 */

import { authenticatedAtom } from "@repo/core/auth";
import { useFeatureTranslation } from "@repo/core/i18n";
import { Button } from "@repo/ui/shadcn/button";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import { AppQuietLoadingState } from "@/components/app-loading";
import { getAppErrorMessage } from "@/lib/user-facing-error";
import { SearchResultCard } from "../components/search-result-card";
import { UnifiedSearchControls } from "../components/unified-search-controls";
import { usePopularTerms, useRecentTerms, useUnifiedSearch } from "../hooks/queries";
import {
  hasActiveSearch,
  parseUnifiedSearch,
  type RawUnifiedSearch,
  toUnifiedSearchUrl,
  type UnifiedSearchFilters,
} from "../lib/unified-search-params";

export function SearchPage() {
  const { t } = useFeatureTranslation("app");
  const navigate = useNavigate();
  const filters = parseUnifiedSearch(useSearch({ strict: false }) as RawUnifiedSearch);

  // URL-driven: every control change navigates, so back/forward and a shared
  // link reproduce the exact search (single source of truth = the address bar).
  function applyFilters(next: UnifiedSearchFilters) {
    navigate({ to: "/search", search: toUnifiedSearchUrl(next) } as never);
  }

  function searchTerm(term: string) {
    applyFilters({ ...filters, q: term });
  }

  const result = useUnifiedSearch(filters);
  const items = result.data?.items ?? [];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-foreground">
          {t("serviceFlow.unifiedSearch.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {filters.q
            ? t("serviceFlow.unifiedSearch.resultsFor", { query: filters.q })
            : t("serviceFlow.unifiedSearch.subtitle")}
        </p>
      </header>

      <UnifiedSearchControls filters={filters} onChange={applyFilters} />

      <PopularTerms onSelect={searchTerm} />
      <RecentTerms onSelect={searchTerm} />

      <SearchBody
        isLoading={result.isPending}
        isError={result.isError}
        error={result.error}
        isEmpty={items.length === 0}
        emptyMessage={
          hasActiveSearch(filters)
            ? t("serviceFlow.unifiedSearch.empty")
            : t("serviceFlow.unifiedSearch.start")
        }
        onRetry={() => void result.refetch()}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {items.map((hit) => (
            <SearchResultCard key={`${hit.entityType}:${hit.entityId}`} hit={hit} />
          ))}
        </div>
      </SearchBody>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 인기 검색어 (public aggregate)                                              */
/* -------------------------------------------------------------------------- */

function PopularTerms({ onSelect }: { onSelect: (term: string) => void }) {
  const { t } = useFeatureTranslation("app");
  const popular = usePopularTerms();
  const terms = popular.data ?? [];

  // Silently absent on load/error: 인기 검색어 is a discovery aid, not core to
  // the search itself — never block the results with its own error surface.
  if (popular.isPending || popular.isError || terms.length === 0) return null;

  return (
    <section data-el="service-flow.popular-terms" className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-foreground">
        {t("serviceFlow.unifiedSearch.popularTitle")}
      </h2>
      <ul className="flex flex-wrap gap-2">
        {terms.map((entry) => (
          <li key={entry.term}>
            <Button type="button" variant="outline" size="sm" onClick={() => onSelect(entry.term)}>
              {entry.term}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* 최근 검색어 (auth-gated — the user's own history)                           */
/* -------------------------------------------------------------------------- */

function RecentTerms({ onSelect }: { onSelect: (term: string) => void }) {
  const { t } = useFeatureTranslation("app");
  // null = session hydrating, false = signed-out, true = signed-in.
  const authenticated = useAtomValue(authenticatedAtom);
  const recent = useRecentTerms(authenticated === true);

  if (authenticated === null) {
    return (
      <section data-el="service-flow.recent-terms">
        <AppQuietLoadingState label={t("serviceFlow.states.checkingSession")} variant="inline" />
      </section>
    );
  }

  // 권한 없음 branch: a logged-out viewer cannot have a personal history.
  if (authenticated === false) {
    return (
      <section
        data-el="service-flow.recent-terms-signed-out"
        className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground"
      >
        {t("serviceFlow.unifiedSearch.recentSignedOut")}
      </section>
    );
  }

  if (recent.isPending || recent.isError) return null;
  const terms = recent.data ?? [];
  if (terms.length === 0) return null;

  return (
    <section data-el="service-flow.recent-terms" className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-foreground">
        {t("serviceFlow.unifiedSearch.recentTitle")}
      </h2>
      <ul className="flex flex-wrap gap-2">
        {terms.map((entry) => (
          <li key={entry.term}>
            <Button type="button" variant="ghost" size="sm" onClick={() => onSelect(entry.term)}>
              {entry.term}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Results body — loading / error / empty / ready                             */
/* -------------------------------------------------------------------------- */

interface SearchBodyProps {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  isEmpty: boolean;
  emptyMessage: string;
  onRetry: () => void;
  children: React.ReactNode;
}

function SearchBody({
  isLoading,
  isError,
  error,
  isEmpty,
  emptyMessage,
  onRetry,
  children,
}: SearchBodyProps) {
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
