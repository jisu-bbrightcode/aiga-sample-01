/**
 * Visual reference: ~/Desktop/CleanShot 2026-05-09 at 00.32.18@2x.png.
 *
 * Project content search page. Default name/title search with @-triggered
 * filter context menu inspired by the referenced desktop screenshot.
 */

import { useFeatureTranslation } from "@repo/core/i18n";
import {
  useCharacters,
  useCodexEntries,
  useDrafts,
  useFactions,
  useLocations,
  useWorlds,
} from "@repo/data/hooks";
import { EntityTable } from "@repo/ui/components/entity-table";
import { LIST_ROW_HEIGHT } from "@repo/ui/lib/list-row";
import { cn } from "@repo/ui/lib/utils";
import { Badge } from "@repo/ui/shadcn/badge";
import { Button } from "@repo/ui/shadcn/button";
import { Input } from "@repo/ui/shadcn/input";
import { useNavigate, useParams } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { CalendarDays, Check, FileText, Search, X } from "lucide-react";
import type { ComponentType, PointerEvent, ReactNode, Ref } from "react";
import { useMemo, useRef, useState } from "react";
import { AppQuietLoadingState } from "@/components/app-loading";
import {
  buildProjectSearchResults,
  DEFAULT_PROJECT_SEARCH_FIELDS,
  PROJECT_SEARCH_FALLBACK_TITLE_KEY,
  PROJECT_SEARCH_RESULT_TYPE_OPTIONS,
  type ProjectSearchResult,
  type ProjectSearchResultType,
  type ProjectSearchUpdatedRange,
} from "../search/project-search-index";
import {
  hasOpenPropertyToken,
  removeOpenPropertyToken,
  stripSearchPropertyToken,
} from "../search/project-search-query";

type TFn = (key: string, options?: Record<string, unknown>) => string;

function getUpdatedRangeOptions(
  t: TFn,
): Array<{ value: ProjectSearchUpdatedRange; label: string }> {
  return [
    { value: "any", label: t("search.updatedRange.any") },
    { value: "day", label: t("search.updatedRange.day") },
    { value: "week", label: t("search.updatedRange.week") },
    { value: "month", label: t("search.updatedRange.month") },
  ];
}

const RESULT_TYPE_ICON_LABEL: Record<ProjectSearchResultType, string> = {
  world: "W",
  character: "C",
  location: "L",
  faction: "F",
  codex: "X",
  draft: "D",
};

interface ProjectSearchTableRow {
  id: string;
  num: number;
  title: string;
  typeLabel: string;
  matchedFieldLabel: string;
  updatedAt: Date | null;
  route: string;
  resultType: ProjectSearchResultType;
  result: ProjectSearchResult;
}

function getProjectSearchTableColumns(t: TFn): ColumnDef<ProjectSearchTableRow>[] {
  return [
    {
      id: "name",
      header: t("search.table.name"),
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="inline-flex shrink-0 items-center font-mono text-xs tracking-[0.02em] text-muted-foreground">
            #{row.original.num}
          </span>
          <span className="flex size-4 shrink-0 items-center justify-center rounded-sm bg-muted text-2xs font-semibold text-muted-foreground">
            {RESULT_TYPE_ICON_LABEL[row.original.resultType]}
          </span>
          <span className="min-w-0 flex-1 truncate text-xs text-sidebar-foreground">
            {row.original.title}
          </span>
        </div>
      ),
    },
    {
      id: "type",
      header: t("search.table.type"),
      cell: ({ row }) => (
        <Badge variant="outline" className="h-4 rounded px-1.5 text-2xs leading-none">
          {row.original.typeLabel}
        </Badge>
      ),
    },
    {
      id: "match",
      header: t("search.table.match"),
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{row.original.matchedFieldLabel}</span>
      ),
    },
    {
      id: "updated",
      header: t("search.table.updated"),
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {formatSearchUpdatedAt(row.original.updatedAt, t)}
        </span>
      ),
    },
  ];
}

export function ProjectSearchPage() {
  const { t } = useFeatureTranslation("feature.story");
  const { projectId } = useParams({ strict: false }) as { projectId: string };
  const navigate = useNavigate();
  const search = useProjectSearchController(projectId, navigate);

  return (
    <div
      data-el="project-search.root"
      className="relative flex h-full min-h-0 flex-col overflow-hidden bg-background"
      onPointerDownCapture={search.handleRootPointerDownCapture}
    >
      <ProjectSearchHeader
        inputRef={search.inputRef}
        query={search.query}
        t={t}
        onQueryChange={search.handleQueryChange}
        onPropertyMenuOpenChange={search.handlePropertyMenuOpenChange}
        onClose={search.handleClose}
      />

      {search.propertyMenuOpen ? (
        <PropertyContextMenu
          resultTypes={search.resultTypes}
          onResultTypesChange={search.setResultTypes}
          updatedRange={search.updatedRange}
          onUpdatedRangeChange={search.setUpdatedRange}
          t={t}
          onMenuCommand={search.commitMenuSelection}
        />
      ) : null}

      <ProjectSearchContent
        hasSearchIntent={search.effectiveQuery.length > 0 || search.hasInstantFilter}
        resultTypes={search.resultTypes}
        onResultTypesChange={search.setResultTypes}
        updatedRange={search.updatedRange}
        onUpdatedRangeChange={search.setUpdatedRange}
        results={search.results}
        isLoading={search.isLoading}
        t={t}
      />
    </div>
  );
}

function useProjectSearchController(projectId: string, navigate: ReturnType<typeof useNavigate>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [propertyMenuOpen, setPropertyMenuOpen] = useState(false);
  const [resultTypes, setResultTypes] = useState<Set<ProjectSearchResultType>>(
    () => new Set(PROJECT_SEARCH_RESULT_TYPE_OPTIONS.map((option) => option.value)),
  );
  const [updatedRange, setUpdatedRange] = useState<ProjectSearchUpdatedRange>("any");
  const effectiveQuery = stripSearchPropertyToken(query);
  const hasInstantFilter =
    updatedRange !== "any" || resultTypes.size !== PROJECT_SEARCH_RESULT_TYPE_OPTIONS.length;
  const { results, isLoading } = useProjectSearchResults({
    projectId,
    query: effectiveQuery,
    resultTypes,
    updatedRange,
    allowEmptyQuery: hasInstantFilter,
  });
  const focusSearchInput = () => {
    queueMicrotask(() => inputRef.current?.focus());
  };
  const commitMenuSelection = () => {
    setQuery((current) => removeOpenPropertyToken(current));
    setPropertyMenuOpen(false);
    focusSearchInput();
  };
  const handleQueryChange = (next: string) => {
    setQuery(next);
    setPropertyMenuOpen(hasOpenPropertyToken(next));
  };
  const handlePropertyMenuOpenChange = (open: boolean) => {
    setPropertyMenuOpen(open);
    focusSearchInput();
  };
  const handleRootPointerDownCapture = (event: PointerEvent<HTMLElement>) => {
    if (!propertyMenuOpen) return;

    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('[data-el="project-search.input"]')) return;
    if (target.closest('[data-el="project-search.property-menu"]')) return;

    setPropertyMenuOpen(false);
  };
  const handleClose = () => {
    if (query) {
      setQuery("");
      return;
    }
    navigate({ to: `/p/${projectId}/drafts` });
  };
  return {
    inputRef,
    query,
    effectiveQuery,
    propertyMenuOpen,
    resultTypes,
    setResultTypes,
    updatedRange,
    setUpdatedRange,
    hasInstantFilter,
    results,
    isLoading,
    handleQueryChange,
    handlePropertyMenuOpenChange,
    handleRootPointerDownCapture,
    handleClose,
    commitMenuSelection,
  };
}

interface ProjectSearchContentProps {
  hasSearchIntent: boolean;
  resultTypes: Set<ProjectSearchResultType>;
  onResultTypesChange: (types: Set<ProjectSearchResultType>) => void;
  updatedRange: ProjectSearchUpdatedRange;
  onUpdatedRangeChange: (range: ProjectSearchUpdatedRange) => void;
  results: ProjectSearchResult[];
  isLoading: boolean;
  t: TFn;
}

function ProjectSearchContent({
  hasSearchIntent,
  resultTypes,
  onResultTypesChange,
  updatedRange,
  onUpdatedRangeChange,
  results,
  isLoading,
  t,
}: ProjectSearchContentProps) {
  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col" data-el="project-search.content">
      <SearchResultToolbar
        resultCount={results.length}
        resultTypes={resultTypes}
        updatedRange={updatedRange}
        t={t}
        onResetFilters={() => {
          onResultTypesChange(
            new Set(PROJECT_SEARCH_RESULT_TYPE_OPTIONS.map((option) => option.value)),
          );
          onUpdatedRangeChange("any");
        }}
      />
      {isLoading ? (
        <AppQuietLoadingState label={t("search.loading")} />
      ) : (
        <SearchResultList hasSearchIntent={hasSearchIntent} results={results} t={t} />
      )}
    </main>
  );
}

function useProjectSearchResults({
  projectId,
  query,
  resultTypes,
  updatedRange,
  allowEmptyQuery,
}: {
  projectId: string;
  query: string;
  resultTypes: Set<ProjectSearchResultType>;
  updatedRange: ProjectSearchUpdatedRange;
  allowEmptyQuery: boolean;
}) {
  const worlds = useWorlds(projectId);
  const characters = useCharacters(projectId);
  const locations = useLocations(projectId);
  const factions = useFactions(projectId);
  const codex = useCodexEntries(projectId);
  const drafts = useDrafts(projectId);

  const isLoading =
    worlds.isLoading ||
    characters.isLoading ||
    locations.isLoading ||
    factions.isLoading ||
    codex.isLoading ||
    drafts.isLoading;

  const results = buildProjectSearchResults({
    source: {
      projectId,
      worlds: (worlds.data ?? []) as unknown[],
      characters: (characters.data ?? []) as unknown[],
      locations: (locations.data ?? []) as unknown[],
      factions: (factions.data ?? []) as unknown[],
      codex: (codex.data ?? []) as unknown[],
      drafts: (drafts.data ?? []) as unknown[],
    },
    query,
    fields: DEFAULT_PROJECT_SEARCH_FIELDS,
    resultTypes,
    updatedRange,
    allowEmptyQuery,
  });

  return { results, isLoading };
}

interface ProjectSearchHeaderProps {
  inputRef: Ref<HTMLInputElement>;
  query: string;
  t: TFn;
  onQueryChange: (query: string) => void;
  onPropertyMenuOpenChange: (open: boolean) => void;
  onClose: () => void;
}

function ProjectSearchHeader({
  inputRef,
  query,
  t,
  onQueryChange,
  onPropertyMenuOpenChange,
  onClose,
}: ProjectSearchHeaderProps) {
  return (
    <header
      data-el="project-search.header"
      className="flex h-11 shrink-0 items-center border-b border-border-subtle bg-background"
    >
      <div className="flex h-full w-14 shrink-0 items-center justify-center">
        <Search className="size-3.5 text-muted-foreground" aria-hidden />
      </div>
      <div className="flex h-full min-w-0 flex-1 items-center gap-2 px-2">
        <Input
          ref={inputRef}
          type="search"
          role="searchbox"
          aria-label={t("search.input.ariaLabel")}
          data-el="project-search.input"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onFocus={() => {
            if (hasOpenPropertyToken(query)) onPropertyMenuOpenChange(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") onPropertyMenuOpenChange(false);
          }}
          placeholder={t("search.input.placeholder")}
          className="h-11 flex-1 border-0 bg-transparent !bg-transparent px-0 text-lg shadow-none focus-visible:border-transparent focus-visible:ring-0"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("search.input.closeAria")}
          onClick={onClose}
        >
          <X className="size-3.5" />
        </Button>
      </div>
    </header>
  );
}

interface SearchResultToolbarProps {
  resultCount: number;
  resultTypes: Set<ProjectSearchResultType>;
  updatedRange: ProjectSearchUpdatedRange;
  t: TFn;
  onResetFilters: () => void;
}

function SearchResultToolbar({
  resultCount,
  resultTypes,
  updatedRange,
  t,
  onResetFilters,
}: SearchResultToolbarProps) {
  const hasNarrowedTypes = resultTypes.size !== PROJECT_SEARCH_RESULT_TYPE_OPTIONS.length;
  const hasFilters = hasNarrowedTypes || updatedRange !== "any";
  const updatedRangeOptions = getUpdatedRangeOptions(t);

  return (
    <div className="flex h-[72px] shrink-0 items-center justify-between px-5">
      <div className="flex min-w-0 items-center gap-2">
        <span
          data-el="project-search.scope-chip"
          className="inline-flex h-8 items-center rounded-full bg-secondary px-4 text-base font-medium text-secondary-foreground"
        >
          {t("search.scope.all")}
        </span>
        <span
          data-el="project-search.result-count"
          className="text-base tabular-nums text-muted-foreground"
        >
          {t("search.toolbar.resultCount", { count: resultCount })}
        </span>
        <Badge variant="outline">{t("search.toolbar.nameDefault")}</Badge>
        {hasNarrowedTypes ? (
          <Badge variant="secondary">{t("search.toolbar.typeFilterApplied")}</Badge>
        ) : null}
        {updatedRange === "any" ? null : (
          <Badge variant="secondary">
            {updatedRangeOptions.find((option) => option.value === updatedRange)?.label}
          </Badge>
        )}
        {hasFilters ? (
          <Button type="button" variant="ghost" size="xs" onClick={onResetFilters}>
            {t("search.toolbar.resetFilters")}
          </Button>
        ) : null}
      </div>
      <div aria-hidden className="h-7 w-7 shrink-0" />
    </div>
  );
}

interface SearchFiltersPopoverProps {
  resultTypes: Set<ProjectSearchResultType>;
  onResultTypesChange: (types: Set<ProjectSearchResultType>) => void;
  updatedRange: ProjectSearchUpdatedRange;
  onUpdatedRangeChange: (range: ProjectSearchUpdatedRange) => void;
}

function PropertyContextMenu({
  resultTypes,
  onResultTypesChange,
  updatedRange,
  onUpdatedRangeChange,
  t,
  onMenuCommand,
}: SearchFiltersPopoverProps & { t: TFn; onMenuCommand: () => void }) {
  const updatedRangeFilterOptions = getUpdatedRangeOptions(t).filter(
    (option) => option.value !== "any",
  );
  return (
    <div
      data-el="project-search.property-menu"
      role="dialog"
      aria-label={t("search.propertyMenu.ariaLabel")}
      className="absolute top-14 left-14 z-40 max-h-[calc(100vh-72px)] w-[350px] overflow-y-auto rounded-lg border border-border-subtle bg-popover text-popover-foreground shadow-[0_18px_48px_rgba(31,29,24,0.14)]"
    >
      <FilterSection title={t("search.propertyMenu.recentSection")}>
        {updatedRangeFilterOptions.map((option) => (
          <PropertyMenuRow
            key={option.value}
            label={option.label}
            caption={t("search.propertyMenu.recentCaption")}
            icon={CalendarDays}
            checked={updatedRange === option.value}
            onClick={() => {
              onUpdatedRangeChange(option.value);
              onMenuCommand();
            }}
          />
        ))}
      </FilterSection>

      <FilterSection title={t("search.propertyMenu.resultTypeSection")}>
        {PROJECT_SEARCH_RESULT_TYPE_OPTIONS.map((option) => {
          const hasTypeFilter = resultTypes.size !== PROJECT_SEARCH_RESULT_TYPE_OPTIONS.length;
          const checked = hasTypeFilter && resultTypes.has(option.value);
          return (
            <PropertyMenuRow
              key={option.value}
              label={t(option.labelKey)}
              caption={t("search.propertyMenu.resultTypeCaption")}
              icon={FileText}
              checked={checked}
              onClick={() => {
                const allTypes = PROJECT_SEARCH_RESULT_TYPE_OPTIONS.map((type) => type.value);
                const next =
                  checked && resultTypes.size === 1 ? new Set(allTypes) : new Set([option.value]);
                onResultTypesChange(next);
                onMenuCommand();
              }}
            />
          );
        })}
      </FilterSection>
    </div>
  );
}

function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-border-subtle border-b px-2 py-2 last:border-b-0">
      <p className="px-2 pb-1.5 text-base leading-5 font-semibold text-muted-foreground">{title}</p>
      <div className="flex flex-col gap-0.5">{children}</div>
    </section>
  );
}

function PropertyMenuRow({
  label,
  caption,
  icon: Icon,
  checked,
  disabled,
  onClick,
}: {
  label: string;
  caption: string;
  icon: ComponentType<{ className?: string }>;
  checked: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="default"
      aria-label={label}
      aria-pressed={checked}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-8 w-full justify-start gap-2.5 rounded-md px-2.5 text-left text-base leading-none font-normal",
        checked ? "bg-muted text-foreground" : "text-foreground",
        disabled ? "disabled:opacity-100" : "",
      )}
    >
      <Icon className="size-3.5 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="ml-auto text-xs leading-none text-muted-foreground">{caption}</span>
      {checked ? <Check className="size-3.5 text-muted-foreground" aria-hidden /> : null}
    </Button>
  );
}

function SearchResultList({
  hasSearchIntent,
  results,
  t,
}: {
  hasSearchIntent: boolean;
  results: ProjectSearchResult[];
  t: TFn;
}) {
  const navigate = useNavigate();
  const columns = useMemo(() => getProjectSearchTableColumns(t), [t]);

  if (results.length === 0) {
    return (
      <div data-el="project-search.empty" className="flex flex-1 items-center justify-center px-6">
        <div className="max-w-[360px] text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-lg bg-muted">
            <Search className="size-3.5 text-muted-foreground" aria-hidden />
          </div>
          <p className="text-base font-medium text-foreground">
            {hasSearchIntent ? t("search.empty.noResults") : t("search.empty.prompt")}
          </p>
          <p className="mt-1 text-base text-muted-foreground">{t("search.empty.hint")}</p>
        </div>
      </div>
    );
  }

  const rows: ProjectSearchTableRow[] = results.map((result, index) => ({
    id: `${result.resultType}:${result.id}`,
    num: index + 1,
    title: result.title || t(PROJECT_SEARCH_FALLBACK_TITLE_KEY),
    typeLabel: t(result.typeLabelKey),
    matchedFieldLabel: result.matchedFieldLabelKey
      ? t(result.matchedFieldLabelKey)
      : t("search.field.name"),
    updatedAt: result.updatedAt,
    route: result.route,
    resultType: result.resultType,
    result,
  }));

  return (
    <EntityTable<ProjectSearchTableRow>
      data={rows}
      columns={columns}
      gridTemplate="minmax(360px,1fr) 96px 96px 120px"
      rowHeight={LIST_ROW_HEIGHT}
      rowClassName="text-xs"
      onRowClick={(row) => navigate({ to: row.route })}
    />
  );
}

function formatSearchUpdatedAt(value: Date | null, t: TFn): string {
  if (!value) return "—";
  const diff = (Date.now() - value.getTime()) / 1000;
  if (!Number.isFinite(diff)) return "—";
  if (diff < 60) return t("search.relTime.justNow");
  if (diff < 3600) return t("search.relTime.minutes", { count: Math.floor(diff / 60) });
  if (diff < 86_400) return t("search.relTime.hours", { count: Math.floor(diff / 3600) });
  if (diff < 604_800) return t("search.relTime.days", { count: Math.floor(diff / 86_400) });
  if (diff < 2_592_000) return t("search.relTime.weeks", { count: Math.floor(diff / 604_800) });
  return t("search.relTime.months", { count: Math.floor(diff / 2_592_000) });
}
