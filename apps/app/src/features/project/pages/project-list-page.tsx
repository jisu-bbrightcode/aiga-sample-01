/**
 * Project grid renderer — receives filter/sort state from the parent UserHome.
 * Owns: grid layout, loading state, empty state, no-results state.
 * Does NOT own: header/topbar/subbar/search input (that's the parent).
 */

import { ANALYTICS_EVENTS, captureEvent, setProjectGroup } from "@repo/core/analytics/client";
import { useFeatureTranslation } from "@repo/core/i18n";
import { useNavigate } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import { CreateProjectDialog } from "../components/create-project-dialog";
import { EmptyProjects, NoResultsState } from "../components/empty-projects";
import { ProjectCard } from "../components/project-card";
import { useArchiveProject, useUpdateLastOpened } from "../hooks/use-project-mutations";
import { useProjects } from "../hooks/use-project-queries";
import { pinnedSetAtom } from "../state/pinned-projects";
import type { SidebarFilter } from "../state/sidebar-filter";

type ScopeId = "all" | "owned" | "starred";
type SortId = "modified" | "name" | "created";
type ProjectRow = NonNullable<ReturnType<typeof useProjects>["data"]>[number];

const PROJECT_LOADING_CARDS = [0, 1, 2, 3] as const;

interface Props {
  activeWorkspaceId?: string | null;
  query: string;
  forceLoading?: boolean;
  scope: ScopeId;
  sortBy: SortId;
  sidebarFilter: SidebarFilter;
  createDialogOpen: boolean;
  onCreateDialogChange: (open: boolean) => void;
  onOpenCreateDialog: () => void;
  onClearFilters: () => void;
}

export function ProjectListPage({
  activeWorkspaceId,
  query,
  forceLoading = false,
  scope,
  sortBy,
  sidebarFilter,
  createDialogOpen,
  onCreateDialogChange,
  onOpenCreateDialog,
  onClearFilters,
}: Props) {
  const { t } = useFeatureTranslation("app");
  const navigate = useNavigate();
  const {
    data: projects,
    isLoading,
    error,
  } = useProjects(activeWorkspaceId, {
    enabled: !forceLoading,
  });
  const archiveProject = useArchiveProject(activeWorkspaceId);
  const updateLastOpened = useUpdateLastOpened(activeWorkspaceId);
  const pinnedSet = useAtomValue(pinnedSetAtom);
  const list = projects ?? [];
  const filtered = filterProjects({
    pinnedSet,
    projects: list,
    query,
    scope,
    sidebarFilter,
    sortBy,
  });

  const handleOpen = (id: string) => {
    captureEvent(ANALYTICS_EVENTS.PROJECT_OPENED, { project_id: id });
    setProjectGroup(id);
    updateLastOpened.mutate(id);
    navigate({ to: "/p/$projectId/lore", params: { projectId: id } });
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-base text-destructive">{t("errors.projectListLoad")}</p>
      </div>
    );
  }

  const totalCount = projects?.length ?? 0;
  const hasFilter = query.trim().length > 0 || scope !== "all" || sidebarFilter !== "all";
  const isProjectLoading = forceLoading || isLoading;
  const isEmpty = !isProjectLoading && totalCount === 0;
  const isNoResults = !isProjectLoading && !isEmpty && filtered.length === 0 && hasFilter;
  let content = (
    <ProjectGrid
      projects={filtered}
      onOpen={handleOpen}
      onArchive={(id) => archiveProject.mutate(id)}
    />
  );

  if (isProjectLoading) {
    content = <ProjectGridLoading />;
  } else if (isEmpty) {
    content = <EmptyProjects onCreateProject={onOpenCreateDialog} />;
  } else if (isNoResults) {
    content = <NoResultsState query={query} onClear={onClearFilters} />;
  }

  return (
    <>
      {content}

      <CreateProjectDialog
        activeWorkspaceId={activeWorkspaceId}
        open={createDialogOpen}
        onOpenChange={onCreateDialogChange}
      />
    </>
  );
}

interface FilterProjectsOptions {
  pinnedSet: ReadonlySet<string>;
  projects: ProjectRow[];
  query: string;
  scope: ScopeId;
  sidebarFilter: SidebarFilter;
  sortBy: SortId;
}

function filterProjects({
  pinnedSet,
  projects,
  query,
  scope,
  sidebarFilter,
  sortBy,
}: FilterProjectsOptions): ProjectRow[] {
  let filtered = projects;

  if (sidebarFilter === "starred") {
    filtered = filtered.filter((project) => pinnedSet.has(project.id));
  } else if (sidebarFilter === "archived" || sidebarFilter === "trash") {
    filtered = [];
  } else if (sidebarFilter === "recent") {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    filtered = filtered.filter((project) => new Date(project.updatedAt).getTime() >= cutoff);
  }

  if (scope === "starred") filtered = filtered.filter((project) => pinnedSet.has(project.id));

  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery) {
    filtered = filtered.filter((project) => matchesProjectQuery(project, normalizedQuery));
  }

  return [...filtered].sort((a, b) => compareProjects(a, b, sortBy, pinnedSet));
}

function matchesProjectQuery(project: ProjectRow, query: string): boolean {
  return (
    project.name.toLowerCase().includes(query) ||
    (project.description?.toLowerCase().includes(query) ?? false) ||
    (project.genre?.toLowerCase().includes(query) ?? false)
  );
}

function compareProjects(
  a: ProjectRow,
  b: ProjectRow,
  sortBy: SortId,
  pinnedSet: ReadonlySet<string>,
): number {
  const aPinned = pinnedSet.has(a.id);
  const bPinned = pinnedSet.has(b.id);
  if (aPinned !== bPinned) return aPinned ? -1 : 1;
  if (sortBy === "name") return a.name.localeCompare(b.name);
  if (sortBy === "created")
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

function ProjectGrid({
  onArchive,
  onOpen,
  projects,
}: {
  onArchive: (id: string) => void;
  onOpen: (id: string) => void;
  projects: ProjectRow[];
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4">
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          id={project.id}
          name={project.name}
          description={project.description}
          coverImage={(project as { coverImage?: string | null }).coverImage ?? null}
          updatedAt={project.updatedAt}
          onOpen={onOpen}
          onArchive={onArchive}
        />
      ))}
    </div>
  );
}

function ProjectGridLoading() {
  return (
    <div
      aria-label="프로젝트 불러오는 중..."
      aria-live="polite"
      className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4"
      role="status"
    >
      {PROJECT_LOADING_CARDS.map((index) => (
        <ProjectCardPlaceholder key={index} />
      ))}
    </div>
  );
}

function ProjectCardPlaceholder() {
  return (
    <div className="relative" aria-hidden data-testid="project-loading-card">
      <div className="absolute inset-0 translate-x-1 translate-y-1 rounded-lg bg-muted/20" />
      <div className="relative flex aspect-[2/3] flex-col overflow-hidden rounded-lg bg-card shadow-sm ring-1 ring-border/50">
        <div className="flex-1 bg-muted/35 motion-safe:animate-pulse" />
        <div className="flex flex-none flex-col gap-2 bg-card px-3.5 py-5">
          <div className="h-4 w-3/4 rounded bg-muted/50 motion-safe:animate-pulse" />
          <div className="h-3 w-full rounded bg-muted/35 motion-safe:animate-pulse" />
          <div className="h-3 w-2/3 rounded bg-muted/35 motion-safe:animate-pulse" />
          <div className="mt-1 flex items-center justify-between gap-2">
            <div className="h-3 w-12 rounded bg-muted/30 motion-safe:animate-pulse" />
            <div className="h-4 w-10 rounded-full bg-muted/30 motion-safe:animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
