import type { AuthErrorLike } from "@repo/core/auth/error-codes";
import { useTranslation } from "@repo/core/i18n";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/shadcn/button";
import { useNavigate } from "@tanstack/react-router";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right";
import Plus from "lucide-react/dist/esm/icons/plus";
import { useEffect, useState } from "react";
import { AppQuietLoadingState } from "@/components/app-loading";
import { authClient } from "../lib/auth-client";
import { getAuthErrorMessage } from "./auth/auth-error-message";
import {
  AuthBrand,
  AuthCard,
  AuthPrimaryButton,
  AuthShell,
  AuthTextButton,
} from "./auth/auth-layout";

interface WorkspaceOrganization {
  id: string;
  name: string;
  slug?: string | null;
  createdAt?: Date | string | null;
  logo?: string | null;
  metadata?: {
    memberCount?: number;
    members?: number;
    plan?: string;
    planName?: string;
    role?: string;
    storyCount?: number;
    stories?: number;
    lastOpenedAt?: string;
    updatedAt?: string;
  } | null;
}

interface AuthQueryResult<T> {
  data?: T;
  isPending: boolean;
  refetch: () => Promise<unknown>;
}

interface AuthMutationResult<T> {
  data?: T | null;
  error?: AuthErrorLike | null;
}

type WorkspaceAuthClient = typeof authClient & {
  useListOrganizations: () => AuthQueryResult<WorkspaceOrganization[]>;
  organization: {
    setActive: (input: { organizationId: string }) => Promise<AuthMutationResult<unknown>>;
  };
};

type Translate = (key: string) => string;

const DEFAULT_WORKSPACE_COLOR = "#1E3A5F";
const WORKSPACE_COLORS = [DEFAULT_WORKSPACE_COLOR, "#7B9DB8", "#B8751A", "#5C574C", "#8E8876"];
const workspaceAuthClient = authClient as unknown as WorkspaceAuthClient;

function getSafeNextPath() {
  if (typeof window === "undefined") return "/";
  const next = new URLSearchParams(window.location.search).get("next");
  if (!next?.startsWith("/") || next.startsWith("//") || next.startsWith("/workspace-select")) {
    return "/";
  }
  return next;
}

function workspaceInitial(name: string) {
  const first = name.trim().charAt(0);
  return first ? first.toUpperCase() : "W";
}

function getActiveOrganizationId(session: unknown): string | null {
  const activeOrganizationId = (session as { session?: { activeOrganizationId?: unknown } } | null)
    ?.session?.activeOrganizationId;
  return typeof activeOrganizationId === "string" && activeOrganizationId.length > 0
    ? activeOrganizationId
    : null;
}

function getRelativeTimeLabel(value: Date | string, t: Translate) {
  const date = new Date(value);
  const timestamp = date.getTime();
  if (Number.isNaN(timestamp)) return null;

  const diff = Date.now() - timestamp;
  const minute = 60 * 1000;
  const day = 24 * 60 * minute;
  if (diff < 60 * minute) return t("workspace.justNow");
  if (diff < day) return t("workspace.today");

  const days = Math.max(1, Math.round(diff / day));
  if (days < 7) return `${days} ${t("workspace.daysAgo")}`;

  const weeks = Math.max(1, Math.round(days / 7));
  return `${weeks} ${weeks === 1 ? t("workspace.weekAgo") : t("workspace.weeksAgo")}`;
}

function getWorkspaceNote(workspace: WorkspaceOrganization, t: Translate) {
  const metadata = workspace.metadata ?? {};
  const storyCount = metadata.storyCount ?? metadata.stories;
  const updated = metadata.lastOpenedAt ?? metadata.updatedAt ?? workspace.createdAt;
  const relativeTime = updated ? getRelativeTimeLabel(updated, t) : null;

  if (typeof storyCount === "number") {
    const storyLabel = storyCount === 1 ? t("workspace.story") : t("workspace.stories");
    return relativeTime
      ? `${storyCount} ${storyLabel} · ${relativeTime}`
      : `${storyCount} ${storyLabel}`;
  }

  if (!updated) return t("workspace.ready");

  return `${t("workspace.created")} ${new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(updated))}`;
}

function getWorkspaceMeta(workspace: WorkspaceOrganization, index: number, t: Translate) {
  const metadata = workspace.metadata ?? {};
  const memberCount = metadata.memberCount ?? metadata.members ?? 1;
  const plan = metadata.planName ?? metadata.plan ?? "Free";
  const role = metadata.role ?? "Member";

  return {
    avatarColor: WORKSPACE_COLORS[index % WORKSPACE_COLORS.length] ?? DEFAULT_WORKSPACE_COLOR,
    memberCount,
    note: getWorkspaceNote(workspace, t),
    plan,
    role,
  };
}

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: Auth design screen keeps form state and data-el render together.
export function WorkspaceSelectPage() {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const sessionQuery = authClient.useSession();
  const organizationsQuery = workspaceAuthClient.useListOrganizations();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<"continue" | null>(null);

  const organizations = (organizationsQuery.data ?? []) as WorkspaceOrganization[];
  const activeOrganizationId = getActiveOrganizationId(sessionQuery.data);
  const signedInEmail = sessionQuery.data?.user?.email ?? t("workspace.fallbackEmail");
  const selectedWorkspace = organizations.find((workspace) => workspace.id === selectedId) ?? null;
  const isLoading = sessionQuery.isPending || organizationsQuery.isPending;

  useEffect(() => {
    if (!sessionQuery.isPending && !sessionQuery.data?.user) {
      navigate({ to: "/sign-in" });
    }
  }, [navigate, sessionQuery.data?.user, sessionQuery.isPending]);

  useEffect(() => {
    const availableOrganizations = (organizationsQuery.data ?? []) as WorkspaceOrganization[];
    if (selectedId || availableOrganizations.length === 0) return;
    const activeWorkspace = availableOrganizations.find(
      (workspace) => workspace.id === activeOrganizationId,
    );
    setSelectedId(activeWorkspace?.id ?? availableOrganizations[0]?.id ?? null);
  }, [activeOrganizationId, organizationsQuery.data, selectedId]);

  const continueToNext = async () => {
    if (!selectedWorkspace || action) return;
    setAction("continue");
    setError(null);

    try {
      const result = await workspaceAuthClient.organization.setActive({
        organizationId: selectedWorkspace.id,
      });
      if (result.error) {
        setError(getAuthErrorMessage(t, result.error, "workspace.selectError"));
        return;
      }
      await sessionQuery.refetch();
      navigate({ to: getSafeNextPath() });
    } catch {
      setError(t("workspace.selectError"));
    } finally {
      setAction(null);
    }
  };

  const openCreateWorkspace = () => {
    const next = getSafeNextPath();
    navigate({
      to: "/create-workspace",
      search: next === "/" ? undefined : { next },
    });
  };

  return (
    <AuthShell wide>
      <AuthCard className="max-w-[480px]" dataEl="workspace.form-card">
        <AuthBrand />

        <header className="space-y-1">
          <h1 className="text-foreground text-2xl leading-[1.3] font-semibold">
            {t("workspace.title")}
          </h1>
          <p className="text-muted-foreground text-sm leading-normal">
            {t("workspace.subtitlePrefix")}{" "}
            <span
              className="text-foreground font-mono text-base font-medium"
              data-el="workspace.signed-in-email"
            >
              {signedInEmail}
            </span>
            .
          </p>
        </header>

        <WorkspaceList
          action={action}
          isLoading={isLoading}
          organizations={organizations}
          selectedId={selectedId}
          onCreate={openCreateWorkspace}
          onSelect={setSelectedId}
          t={t}
        />

        {error ? (
          <p className="text-destructive text-base" data-el="workspace.error-message">
            {error}
          </p>
        ) : null}

        <AuthPrimaryButton
          type="button"
          loading={action === "continue"}
          disabled={!selectedWorkspace || action !== null || isLoading}
          onClick={continueToNext}
          data-el="workspace.continue"
        >
          {t("workspace.continue")}
        </AuthPrimaryButton>

        <p className="text-muted-foreground pt-1 text-center text-base">
          {t("workspace.invitePrefix")}{" "}
          <AuthTextButton onClick={() => setError(t("workspace.inviteHint"))}>
            {t("workspace.joinWithCode")}
          </AuthTextButton>
        </p>
      </AuthCard>
    </AuthShell>
  );
}

function WorkspaceList({
  action,
  isLoading,
  organizations,
  onCreate,
  onSelect,
  selectedId,
  t,
}: {
  action: "continue" | null;
  isLoading: boolean;
  organizations: WorkspaceOrganization[];
  onCreate: () => void;
  onSelect: (id: string) => void;
  selectedId: string | null;
  t: Translate;
}) {
  return (
    <div
      className="flex min-h-0 max-h-[min(360px,44dvh)] flex-col gap-2 overflow-y-auto overscroll-contain pr-1 pt-0.5 [scrollbar-width:thin]"
      data-el="workspace.list"
    >
      {isLoading ? (
        <AppQuietLoadingState
          className="bg-card min-h-[214px] rounded-[10px]"
          label={t("workspace.loading")}
          variant="inline"
        />
      ) : (
        organizations.map((workspace, index) => (
          <WorkspaceRow
            key={workspace.id}
            active={selectedId === workspace.id}
            meta={getWorkspaceMeta(workspace, index, t)}
            onSelect={() => onSelect(workspace.id)}
            t={t}
            workspace={workspace}
          />
        ))
      )}
      <CreateWorkspaceRow action={action} onCreate={onCreate} t={t} />
    </div>
  );
}

function WorkspaceRow({
  active,
  meta,
  onSelect,
  t,
  workspace,
}: {
  active: boolean;
  meta: ReturnType<typeof getWorkspaceMeta>;
  onSelect: () => void;
  t: Translate;
  workspace: WorkspaceOrganization;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      className={cn(
        "bg-card hover:bg-muted flex h-auto w-full items-center justify-start gap-3 rounded-[10px] border-0 px-3.5 py-3 text-left shadow-none transition-colors",
        active && "bg-muted",
      )}
      aria-pressed={active}
      onClick={onSelect}
      data-el="workspace.row"
    >
      <WorkspaceAvatar color={meta.avatarColor} logo={workspace.logo} name={workspace.name} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-foreground truncate text-sm font-semibold">{workspace.name}</span>
        <span className="text-muted-foreground inline-flex min-w-0 items-center gap-1.5 text-xs">
          <span className="text-primary font-medium">{meta.role}</span>
          <span aria-hidden="true">·</span>
          <span>
            {meta.memberCount}{" "}
            {meta.memberCount === 1 ? t("workspace.member") : t("workspace.members")}
          </span>
          <span aria-hidden="true">·</span>
          <span>{meta.plan}</span>
        </span>
        <span className="text-muted-foreground truncate font-mono text-xs">{meta.note}</span>
      </span>
      <span
        className={cn(
          "bg-muted grid size-4 shrink-0 place-items-center rounded-full",
          active && "bg-primary/10",
        )}
        aria-hidden="true"
      >
        {active ? <span className="bg-primary size-2 rounded-full" /> : null}
      </span>
    </Button>
  );
}

function WorkspaceAvatar({
  color,
  logo,
  name,
}: {
  color: string;
  logo?: string | null;
  name: string;
}) {
  return (
    <span
      className="grid size-9 shrink-0 place-items-center rounded-lg font-semibold text-white"
      style={{ background: logo ? undefined : color }}
    >
      {logo ? (
        <img src={logo} alt="" className="size-full rounded-lg object-cover" aria-hidden="true" />
      ) : (
        workspaceInitial(name)
      )}
    </span>
  );
}

function CreateWorkspaceRow({
  action,
  onCreate,
  t,
}: {
  action: "continue" | null;
  onCreate: () => void;
  t: Translate;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      className="bg-card hover:bg-muted flex h-auto w-full items-center justify-start gap-3 rounded-[10px] border-0 px-3.5 py-3 text-left shadow-none"
      onClick={onCreate}
      disabled={action !== null}
      data-el="workspace.create"
    >
      <span className="bg-muted text-muted-foreground grid size-9 shrink-0 place-items-center rounded-lg">
        <Plus className="size-[15px]" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-foreground text-sm font-semibold">{t("workspace.createTitle")}</span>
        <span className="text-muted-foreground text-xs">{t("workspace.createSubtitle")}</span>
      </span>
      <ArrowRight className="text-muted-foreground size-3.5 shrink-0" />
    </Button>
  );
}
