/**
 * Workspace project hub — crumb topbar + status-tab subbar + card grid.
 * Mirrors HubTopbar + HubSubbar + .proj-grid composition in the design.
 */

import { Button } from "@repo/ui/shadcn/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/shadcn/dropdown-menu";
import { Input } from "@repo/ui/shadcn/input";
import { useFeatureTranslation } from "@repo/core/i18n";
import { useAtom, useAtomValue } from "jotai";
import { ArrowDownUp, Check, Plus, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useProjects } from "@/features/project/hooks/use-project-queries";
import { ProjectListPage } from "@/features/project/pages/project-list-page";
import { sidebarFilterAtom } from "@/features/project/state/sidebar-filter";
import {
  activeWorkspaceOverrideAtom,
  getEffectiveActiveWorkspaceId,
} from "@/features/workspace/active-workspace";
import { authClient } from "@/lib/auth-client";

type TFn = ReturnType<typeof useFeatureTranslation>["t"];

type ScopeId = "all" | "owned" | "starred";
type SortId = "modified" | "name" | "created";

function buildScopes(t: TFn): ReadonlyArray<{ id: ScopeId; label: string }> {
  return [
    { id: "all", label: t("home.scope.all") },
    { id: "owned", label: t("home.scope.owned") },
    { id: "starred", label: t("home.scope.starred") },
  ];
}

function buildSortOptions(t: TFn): ReadonlyArray<{ id: SortId; label: string }> {
  return [
    { id: "modified", label: t("home.sort.modified") },
    { id: "name", label: t("home.sort.name") },
    { id: "created", label: t("home.sort.created") },
  ];
}

export function UserHome() {
  const { t } = useFeatureTranslation("app");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [scope, setScope] = useState<ScopeId>("all");
  const [sortBy, setSortBy] = useState<SortId>("modified");
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const { data: session } = authClient.useSession();
  const activeWorkspaceOverride = useAtomValue(activeWorkspaceOverrideAtom);
  const activeWorkspaceId = getEffectiveActiveWorkspaceId(session, activeWorkspaceOverride);
  const isWorkspaceSwitching = activeWorkspaceOverride?.isSwitching === true;
  const { data: projects } = useProjects(activeWorkspaceId, { enabled: !isWorkspaceSwitching });
  const workspaceName = useActiveWorkspaceName(activeWorkspaceId, t);
  const sidebarFilter = useAtom(sidebarFilterAtom);
  const [sidebarFilterValue, setSidebarFilter] = sidebarFilter;

  const SCOPES = buildScopes(t);
  const SORT_OPTIONS = buildSortOptions(t);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const projectCount = isWorkspaceSwitching ? 0 : (projects?.length ?? 0);

  const sortLabel = SORT_OPTIONS.find((o) => o.id === sortBy)?.label ?? "";

  return (
    <div className="flex h-full w-full flex-col bg-background">
      {/* Topbar — crumbs + new project */}
      <div className="flex h-11 flex-none items-center justify-between pl-3.5 pr-7">
        <div className="flex items-center gap-1.5 text-base text-muted-foreground">
          <span className="truncate">{workspaceName}</span>
          <span className="text-muted-foreground/50">/</span>
          <span className="font-medium text-foreground">{t("home.crumb.projects")}</span>
        </div>
        <Button
          size="sm"
          onClick={() => setCreateDialogOpen(true)}
          className="h-8 gap-1.5 px-3 text-base"
          data-el="project-list.new-project-btn"
        >
          <Plus className="size-3.5" />
          {t("home.newProject")}
        </Button>
      </div>

      {/* Subbar — scope tabs + search/sort */}
      <div className="flex h-11 flex-none items-center justify-between pl-3.5 pr-7">
        <div className="flex items-center gap-1">
          {SCOPES.map((s) => (
            <ScopeTab
              key={s.id}
              active={scope === s.id}
              onClick={() => setScope(s.id)}
              label={s.label}
              count={getScopeCount(s.id, projectCount)}
              dataEl={`project-list.scope-tab-${s.id}`}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          {searchOpen ? (
            <div
              data-el="project-list.search-bar"
              className="flex h-7 min-w-60 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 focus-within:border-primary"
            >
              <Search className="size-3.5 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("home.search.placeholder")}
                className="h-auto flex-1 border-0 bg-transparent p-0 text-base shadow-none focus-visible:ring-0"
                data-el="project-list.search-input"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  setQuery("");
                  setSearchOpen(false);
                }}
                className="size-4 rounded p-0 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={t("home.search.close")}
                data-el="project-list.search-close-btn"
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchOpen(true)}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              aria-label={t("home.search.open")}
              data-el="project-list.search-open-btn"
            >
              <Search className="size-3.5" />
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={t("home.sort.label")}
              title={t("home.sort.titleWithValue", { value: sortLabel })}
              className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-el="project-list.sort-trigger"
            >
              <ArrowDownUp className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              <div className="px-2 pb-1 pt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t("home.sort.heading")}
              </div>
              {SORT_OPTIONS.map((o) => (
                <DropdownMenuItem
                  key={o.id}
                  onSelect={() => setSortBy(o.id)}
                  className="flex items-center justify-between"
                  data-el={`project-list.sort-option-${o.id}`}
                >
                  <span>{o.label}</span>
                  {sortBy === o.id ? <Check className="size-3.5 text-primary" /> : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Content — grid */}
      <div className="flex-1 overflow-auto">
        <div className="pb-20 pl-3.5 pr-7 pt-2">
          <ProjectListPage
            activeWorkspaceId={activeWorkspaceId}
            query={query}
            forceLoading={isWorkspaceSwitching}
            scope={scope}
            sortBy={sortBy}
            sidebarFilter={sidebarFilterValue}
            createDialogOpen={createDialogOpen}
            onCreateDialogChange={setCreateDialogOpen}
            onOpenCreateDialog={() => setCreateDialogOpen(true)}
            onClearFilters={() => {
              setQuery("");
              setSearchOpen(false);
              setScope("all");
              setSidebarFilter("all");
            }}
          />
        </div>
      </div>
    </div>
  );
}

interface ScopeTabProps {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
  dataEl?: string;
}

function ScopeTab({ active, label, count, onClick, dataEl }: ScopeTabProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      data-el={dataEl}
      className={
        active
          ? "inline-flex h-7 items-center gap-1.5 rounded-md bg-card px-2.5 text-base font-medium text-foreground shadow-sm hover:bg-card"
          : "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-base text-muted-foreground hover:bg-muted hover:text-foreground"
      }
    >
      {label}
      {count > 0 ? (
        <span
          className={
            active
              ? "font-mono text-xs font-medium text-foreground/70"
              : "font-mono text-xs font-medium text-muted-foreground/70"
          }
        >
          {count}
        </span>
      ) : null}
    </Button>
  );
}

function getScopeCount(scope: ScopeId, projectCount: number): number {
  if (scope === "all" || scope === "owned") return projectCount;
  return 0;
}

interface OrgListItem {
  id: string;
  name: string;
}

type ListOrgsHook = () => { data?: OrgListItem[]; isPending: boolean };

const listOrganizations = (authClient as unknown as { useListOrganizations: ListOrgsHook })
  .useListOrganizations;

function useActiveWorkspaceName(activeOrgId: string | null, t: TFn): string {
  const orgs = listOrganizations();
  if (typeof activeOrgId === "string" && orgs.data) {
    const found = orgs.data.find((o) => o.id === activeOrgId);
    if (found) return found.name;
  }
  return t("home.workspaceFallback");
}
