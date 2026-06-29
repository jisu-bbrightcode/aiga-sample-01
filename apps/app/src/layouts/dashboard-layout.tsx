/**
 * Workspace hub shell — left HubSidebar (workspace switcher + project filters) + main outlet.
 * Mirrors the .shell + .sidebar + .main composition of the design.
 */

import { AuthGuard, authenticatedAtom } from "@repo/core/auth";
import { useFeatureTranslation } from "@repo/core/i18n";
import { cn } from "@repo/ui/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/shadcn/dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";
import { Outlet, useMatchRoute, useNavigate } from "@tanstack/react-router";
import { useAtom, useAtomValue } from "jotai";
import {
  Archive,
  Check,
  ChevronDown,
  Clock,
  Folder,
  LogOut,
  Plus,
  Settings,
  Star,
  Trash2,
  Users,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { AppAuthLoadingState, AppWorkspaceLoadingState } from "@/components/app-loading";
import {
  getWorkspaceProjectListQueryKey,
  PROJECT_LIST_QUERY_KEY,
} from "@/features/project/hooks/use-project-queries";
import { sidebarFilterAtom } from "@/features/project/state/sidebar-filter";
import {
  activeWorkspaceOverrideAtom,
  getEffectiveActiveWorkspaceId,
  getSessionActiveWorkspaceId,
} from "@/features/workspace/active-workspace";
import { apiClient } from "@/lib/api";
import { useRequireActiveWorkspace } from "@/pages/auth/use-require-active-workspace";
import { SETTINGS_PROJECTS_LIST_QUERY_KEY } from "@/pages/settings/api";
import { authClient } from "../lib/auth-client";

interface OrgListItem {
  id: string;
  name: string;
  slug?: string | null;
  logo?: string | null;
}

interface AuthMutationResult<T> {
  data?: T | null;
  error?: { message?: string; code?: string } | null;
}

type ListOrgsHook = () => {
  data?: OrgListItem[];
  isPending: boolean;
  refetch?: () => Promise<unknown>;
};

const listOrganizations = (
  authClient as unknown as {
    useListOrganizations: ListOrgsHook;
    organization: {
      setActive: (input: { organizationId: string }) => Promise<unknown>;
    };
  }
).useListOrganizations;

export function DashboardLayout() {
  const { t } = useFeatureTranslation("app");
  const navigate = useNavigate();
  const authenticated = useAtomValue(authenticatedAtom);
  const { activeWorkspaceId, isCheckingWorkspace, needsWorkspace } = useRequireActiveWorkspace(
    authenticated === true,
  );
  const isBootstrappingHome = useHomeProjectBootstrap(
    authenticated === true && !isCheckingWorkspace && !needsWorkspace,
    activeWorkspaceId,
  );

  return (
    <AuthGuard
      authenticated={authenticated}
      onUnauthenticated={() => {
        navigate({ to: "/sign-in" });
      }}
      loadingFallback={
        <AppAuthLoadingState label={null} loaderLabel={t("layout.loading.session")} />
      }
    >
      {isCheckingWorkspace || needsWorkspace || isBootstrappingHome ? (
        <AppWorkspaceLoadingState label={null} loaderLabel={t("layout.loading.home")} />
      ) : (
        <div className="flex h-dvh overflow-hidden bg-background">
          <HubSidebar />
          <main className="flex flex-1 flex-col overflow-hidden">
            <Outlet />
          </main>
        </div>
      )}
    </AuthGuard>
  );
}

function useHomeProjectBootstrap(enabled: boolean, activeWorkspaceId: string | null): boolean {
  const queryClient = useQueryClient();
  const projectListQueryKey = useMemo(
    () => getWorkspaceProjectListQueryKey(PROJECT_LIST_QUERY_KEY, activeWorkspaceId),
    [activeWorkspaceId],
  );
  const hasCachedProjects = queryClient.getQueryData(projectListQueryKey) !== undefined;
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (!enabled || !activeWorkspaceId || hasCachedProjects) {
      setCompleted(false);
      return;
    }

    let cancelled = false;
    setCompleted(false);
    void queryClient
      .prefetchQuery({
        queryKey: projectListQueryKey,
        queryFn: () =>
          apiClient.GET("/api/projects", {}).then(({ data, error }) => {
            if (error) throw error;
            return data ?? [];
          }),
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setCompleted(true);
      });

    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId, enabled, hasCachedProjects, projectListQueryKey, queryClient]);

  return enabled && Boolean(activeWorkspaceId) && !hasCachedProjects && !completed;
}

function HubSidebar() {
  const { t } = useFeatureTranslation("app");
  const sessionQuery = authClient.useSession();
  const { data: session } = sessionQuery;
  const orgsResult = listOrganizations();
  const [activeWorkspaceOverride, setActiveWorkspaceOverride] = useAtom(
    activeWorkspaceOverrideAtom,
  );
  const sessionActiveOrgId = getSessionActiveWorkspaceId(session);
  const activeOrgId = getEffectiveActiveWorkspaceId(session, activeWorkspaceOverride);
  const organizations = orgsResult.data ?? [];
  const current = organizations.find((o) => o.id === activeOrgId) ?? organizations[0];
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [switchingOrgId, setSwitchingOrgId] = useState<string | null>(null);

  useEffect(() => {
    if (
      activeWorkspaceOverride &&
      !activeWorkspaceOverride.isSwitching &&
      sessionActiveOrgId === activeWorkspaceOverride.organizationId
    ) {
      setActiveWorkspaceOverride(null);
    }
  }, [activeWorkspaceOverride, sessionActiveOrgId, setActiveWorkspaceOverride]);

  const handleSwitch = async (orgId: string) => {
    if (orgId === activeOrgId || switchingOrgId) return;
    setSwitchingOrgId(orgId);
    setActiveWorkspaceOverride({ organizationId: orgId, isSwitching: true });
    try {
      const result = await (
        authClient as unknown as {
          organization: {
            setActive: (input: { organizationId: string }) => Promise<AuthMutationResult<unknown>>;
          };
        }
      ).organization.setActive({ organizationId: orgId });
      if (result.error) {
        throw new Error(result.error.message ?? result.error.code ?? "Workspace switch failed");
      }
      await sessionQuery.refetch?.();
      await orgsResult.refetch?.();
      const workspaceProjectListQueryKey = getWorkspaceProjectListQueryKey(
        PROJECT_LIST_QUERY_KEY,
        orgId,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: workspaceProjectListQueryKey }),
        queryClient.invalidateQueries({ queryKey: SETTINGS_PROJECTS_LIST_QUERY_KEY }),
      ]);
      await queryClient
        .prefetchQuery({
          queryKey: workspaceProjectListQueryKey,
          queryFn: () =>
            apiClient.GET("/api/projects", {}).then(({ data, error }) => {
              if (error) throw error;
              return data ?? [];
            }),
        })
        .catch(() => undefined);
      setActiveWorkspaceOverride({ organizationId: orgId, isSwitching: false });
      navigate({ to: "/" });
    } catch (error) {
      setActiveWorkspaceOverride(null);
      console.error("[workspace] failed to switch active organization", error);
    } finally {
      setSwitchingOrgId(null);
    }
  };

  const handleSignOut = async () => {
    await authClient.signOut();
    navigate({ to: "/sign-in" });
  };

  return (
    <aside className="flex h-full w-[240px] flex-none flex-col bg-background">
      {/* Workspace selector */}
      <div className="flex h-11 items-center px-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex h-11 w-full items-center gap-2.5 rounded-md px-2 text-left leading-tight transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <WorkspaceAvatar name={current?.name ?? "Workspace"} />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-base font-medium text-foreground">
                {current?.name ?? t("layout.workspaceFallback")}
              </span>
              {session?.user?.email ? (
                <span className="truncate text-xs text-muted-foreground">
                  {session.user.email}
                </span>
              ) : null}
            </div>
            <ChevronDown className="size-3.5 flex-none text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[224px]">
            <div className="px-2 pb-1 pt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("layout.workspaceHeading")}
            </div>
            {organizations.map((org) => (
              <DropdownMenuItem
                key={org.id}
                onClick={() => {
                  void handleSwitch(org.id);
                }}
                className="flex items-center gap-2.5"
                disabled={switchingOrgId !== null}
              >
                <WorkspaceAvatar name={org.name} size="sm" />
                <span className="flex-1 truncate text-base">{org.name}</span>
                {org.id === activeOrgId ? <Check className="size-3.5 text-primary" /> : null}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate({ to: "/create-workspace" })}>
              <Plus className="mr-2 size-3.5" />
              {t("layout.newWorkspace")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate({ to: "/settings/organization" })}>
              <Settings className="mr-2 size-3.5" />
              {t("layout.workspaceSettings")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 size-3.5" />
              {t("layout.signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Main filters */}
      <nav className="flex flex-1 flex-col gap-3 px-3 py-4">
        <SidebarCommunityLink />
        <SidebarFilterGroup />
      </nav>
    </aside>
  );
}

interface SidebarItemProps {
  icon: ReactNode;
  label: string;
  active?: boolean;
  count?: number;
  onClick?: () => void;
}

function SidebarFilterGroup() {
  const { t } = useFeatureTranslation("app");
  const [filter, setFilter] = useAtom(sidebarFilterAtom);
  return (
    <>
      <div className="flex flex-col">
        <SidebarItem
          icon={<Folder className="size-3.5" />}
          label={t("layout.filter.all")}
          active={filter === "all"}
          onClick={() => setFilter("all")}
        />
        <SidebarItem
          icon={<Star className="size-3.5" />}
          label={t("layout.filter.starred")}
          active={filter === "starred"}
          onClick={() => setFilter("starred")}
        />
        <SidebarItem
          icon={<Clock className="size-3.5" />}
          label={t("layout.filter.recent")}
          active={filter === "recent"}
          onClick={() => setFilter("recent")}
        />
      </div>

      <div className="flex flex-col">
        <div className="px-2 pb-1 pt-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t("layout.filter.manage")}
        </div>
        <SidebarItem
          icon={<Archive className="size-3.5" />}
          label={t("layout.filter.archived")}
          active={filter === "archived"}
          onClick={() => setFilter("archived")}
        />
        <SidebarItem
          icon={<Trash2 className="size-3.5" />}
          label={t("layout.filter.trash")}
          active={filter === "trash"}
          onClick={() => setFilter("trash")}
        />
      </div>
    </>
  );
}

function SidebarCommunityLink() {
  const navigate = useNavigate();
  const matchRoute = useMatchRoute();
  const active =
    Boolean(matchRoute({ to: "/communities", fuzzy: true })) ||
    Boolean(matchRoute({ to: "/home", fuzzy: false })) ||
    Boolean(matchRoute({ to: "/c/$slug", fuzzy: true }));
  return (
    <div className="flex flex-col">
      <SidebarItem
        icon={<Users className="size-3.5" />}
        label="커뮤니티"
        active={active}
        onClick={() => navigate({ to: "/communities" })}
      />
    </div>
  );
}

function SidebarItem({ icon, label, active = false, count, onClick }: SidebarItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-8 items-center gap-2 rounded-md px-2 text-base transition-colors",
        active
          ? "bg-muted font-medium text-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <span className="flex-none text-current">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      {typeof count === "number" && count > 0 ? (
        <span
          className={cn(
            "font-mono text-xs",
            active ? "text-foreground/70" : "text-muted-foreground/70",
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

const AVATAR_COLORS = [
  "linear-gradient(135deg, #C9A861 0%, #8B6F2C 100%)",
  "linear-gradient(135deg, #1E3A5F 0%, #0E2238 100%)",
  "linear-gradient(135deg, #6B5BB8 0%, #38296F 100%)",
  "linear-gradient(135deg, #2D7A6B 0%, #133E36 100%)",
  "linear-gradient(135deg, #A53D2D 0%, #5B1810 100%)",
  "linear-gradient(135deg, #1E5C7C 0%, #0B2E40 100%)",
] as const;

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] ?? AVATAR_COLORS[0];
}

interface WorkspaceAvatarProps {
  name: string;
  size?: "sm" | "md";
}

function WorkspaceAvatar({ name, size = "md" }: WorkspaceAvatarProps) {
  const initial = (name.trim().charAt(0) || "W").toUpperCase();
  const color = avatarColor(name);
  return (
    <div
      aria-hidden
      className={cn(
        "grid flex-none place-items-center rounded-md font-semibold text-white",
        size === "sm" ? "size-5 text-2xs" : "size-6 text-xs",
      )}
      style={{ background: color }}
    >
      {initial}
    </div>
  );
}
