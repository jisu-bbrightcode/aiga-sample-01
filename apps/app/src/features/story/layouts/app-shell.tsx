/**
 * Application Shell — shadcn Sidebar + SidebarInset.
 * data-el: shell.sidebar, shell.sidebar-item
 */

import { useFeatureTranslation } from "@repo/core/i18n";
import { useCreateDraft } from "@repo/data/hooks";
import { DataProvider } from "@repo/data/provider";
import { createRemoteBackend } from "@repo/data/remote";
import type { DataBackend } from "@repo/data/types";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/shadcn/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
} from "@repo/ui/shadcn/sidebar";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, Outlet, useMatchRoute, useNavigate, useParams } from "@tanstack/react-router";
import { BookOpen, BookText, Cloud, FileText, Film, Globe, Loader2, MapPin, MessageCircle, Shield, User, X } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api";
import {
  characterChatKeys,
  hideCharacterChatListItem,
  useCharacterActors,
  useHiddenCharacterActorIds,
} from "../api/operator-chat";
import { CreateEntityDialog } from "../components/create-entity-dialog";
import { ProjectSwitcher } from "../components/project-switcher";

interface StoryShellFrameProps {
  projectId?: string;
  backend: DataBackend;
  children?: ReactNode;
}

export function AppShell() {
  const { projectId } = useParams({ strict: false }) as {
    projectId?: string;
  };

  useEffect(() => {
    if (!projectId) return;
    void import("../pages/entity-detail-page");
  }, [projectId]);

  const backend = useMemo(() => createRemoteBackend({ api: apiClient }), []);

  return <StoryDataShellFrame projectId={projectId} backend={backend} />;
}

/* Components */

function StoryDataShellFrame({
  projectId,
  backend,
  children,
}: StoryShellFrameProps) {
  return (
    <DataProvider backend={backend}>
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
        <SidebarProvider
          defaultOpen
          style={
            {
              "--sidebar-width": "240px",
              "--sidebar-width-icon": "240px",
            } as React.CSSProperties
          }
          className="min-h-0 flex-1"
        >
          <StorySidebar projectId={projectId} />
          <SidebarInset className="bg-background h-full overflow-x-hidden overflow-y-auto">
            {children ?? <Outlet />}
          </SidebarInset>
        </SidebarProvider>
      </div>
    </DataProvider>
  );
}

function StorySidebar({
  projectId,
}: {
  projectId?: string;
}) {
  const pid = projectId ?? "";

  return <StorySidebarFrame projectId={pid} />;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: sidebar nav matchers
function StorySidebarFrame({
  projectId,
}: {
  projectId: string;
}) {
  const pid = projectId;
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const createDraft = useCreateDraft();
  const { t } = useFeatureTranslation("feature.story");

  const handleCreate = (data: { name: string; description: string; entityType: string }) => {
    if (!pid) return;
    // 기본값 = 초안 생성
    createDraft.mutate(
      { projectId: pid, title: data.name, description: data.description },
      {
        onSuccess: () => {
          setCreateOpen(false);
          navigate({ to: `/p/${pid}/drafts` });
        },
      },
    );
  };

  return (
    <Sidebar
      data-el="shell.sidebar"
      collapsible="offExamples"
      className="overflow-x-hidden border-r-0"
    >
      <SidebarHeader className="flex h-11 flex-col justify-center p-0 px-2.5">
        <ProjectSwitcher onCreateNew={() => setCreateOpen(true)} />
      </SidebarHeader>

      <SidebarContent className="gap-0.5 overflow-x-hidden px-2.5 pb-3.5">
        {/* 초안 */}
        <NavSection>
          <NavItem
            to={pid ? `/p/${pid}/drafts` : "#"}
            icon={FileText}
            label={t("shell.nav.drafts")}
          />
        </NavSection>

        {/* 세계관 */}
        <NavSection label={t("shell.nav.section.lore")}>
          <NavItem
            to={pid ? `/p/${pid}/lore` : "#"}
            icon={Globe}
            label={t("shell.nav.world")}
            exact
          />
          <NavItem
            to={pid ? `/p/${pid}/lore/characters` : "#"}
            icon={User}
            label={t("shell.nav.characters")}
          />
          <NavItem
            to={pid ? `/p/${pid}/lore/locations` : "#"}
            icon={MapPin}
            label={t("shell.nav.locations")}
          />
          <NavItem
            to={pid ? `/p/${pid}/lore/factions` : "#"}
            icon={Shield}
            label={t("shell.nav.factions")}
          />
          <NavItem
            to={pid ? `/p/${pid}/lore/codex` : "#"}
            icon={BookOpen}
            label={t("shell.nav.codex")}
          />
        </NavSection>

        {/* 채팅 */}
        <ChatSidebarSection projectId={pid ?? ""} />

        {/* 현지화 */}
        <NavSection label={t("shell.nav.section.localization")}>
          <NavItem
            to={pid ? `/p/${pid}/localization/lore` : "#"}
            icon={Film}
            label={t("shell.nav.localizationLore")}
          />
          <NavItem
            to={pid ? `/p/${pid}/localization/glossary` : "#"}
            icon={BookText}
            label={t("shell.nav.localizationGlossary")}
          />
        </NavSection>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center justify-between gap-3 px-2.5 py-1.5">
          <SyncStatus />
        </div>
      </SidebarFooter>
      <CreateEntityDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
        isLoading={createDraft.isPending}
      />
    </Sidebar>
  );
}

/* Chat sidebar section */

function ChatSidebarSection({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const { t } = useFeatureTranslation("feature.story");
  const { data: actors = [] } = useCharacterActors(projectId);
  const { data: hiddenIds = [] } = useHiddenCharacterActorIds(projectId);
  const hideMutation = useMutation({
    mutationFn: hideCharacterChatListItem,
    onSuccess: (_data, { actorId }) => {
      // hiddenIds 캐시에 즉시 추가 (refetch 전 UI 즉시 반영)
      qc.setQueryData<string[]>(characterChatKeys.hiddenActorIds(projectId), (old = []) => [
        ...old,
        actorId,
      ]);
      void qc.invalidateQueries({
        queryKey: characterChatKeys.hiddenActorIds(projectId),
      });
    },
  });

  const visibleActors = actors.filter(
    (a) =>
      (a.status === "ready" || a.status === "preparing" || a.status === "failed") &&
      !hiddenIds.includes(a.id),
  );

  if (visibleActors.length === 0) return null;

  return (
    <div data-el="shell.chat-section">
      <NavSection label={t("chat.crumbs.title")}>
        {visibleActors.map((actor) => (
          <ChatActorNavItem
            key={actor.id}
            actor={actor}
            projectId={projectId}
            onHide={() => hideMutation.mutate({ projectId, actorId: actor.id })}
          />
        ))}
      </NavSection>
    </div>
  );
}

function ChatActorNavItem({
  actor,
  projectId,
  onHide,
}: {
  actor: {
    id: string;
    characterId: string;
    status: string;
    character?: { name?: string | null } | null;
  };
  projectId: string;
  onHide: () => void;
}) {
  const matchRoute = useMatchRoute();
  const { t } = useFeatureTranslation("feature.story");
  const isActive = !!matchRoute({
    to: "/p/$projectId/chat/$characterId",
    params: { projectId, characterId: actor.characterId },
    fuzzy: true,
  });
  const name = actor.character?.name ?? t("chat.characterFallback");

  return (
    <div className="group/chat-item flex items-center" data-el="shell.chat-item-wrapper">
      <Link
        to="/p/$projectId/chat/$characterId"
        params={{ projectId, characterId: actor.characterId }}
        data-el="shell.chat-item"
        data-active={isActive ? "" : undefined}
        className={cn(
          "flex h-7 flex-1 items-center gap-2.5 rounded-md px-2.5 text-base leading-none transition-colors",
          isActive
            ? "bg-foreground/5 text-sidebar-foreground font-medium"
            : "text-sidebar-foreground hover:bg-muted hover:text-foreground font-normal",
        )}
      >
        {actor.status === "preparing" ? (
          <Loader2 className="text-sidebar-foreground/70 size-3.5 shrink-0 animate-spin" />
        ) : (
          <MessageCircle className="text-sidebar-foreground/70 size-3.5 shrink-0" />
        )}
        <span className="min-w-0 flex-1 truncate">{name}</span>
      </Link>
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 shrink-0 opacity-0 transition-opacity group-hover/chat-item:opacity-100"
        data-el="shell.chat-item-hide"
        onClick={(e) => {
          e.stopPropagation();
          onHide();
        }}
      >
        <X className="size-3.5" />
      </Button>
    </div>
  );
}

/* Sidebar nav primitives — /tmp/product-builder-design/Sidebar.jsx .nav-group / .item 매칭 */

function NavSection({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div data-el="shell.nav-group" className="mt-1.5 flex flex-col first:mt-0">
      {label ? (
        <div
          data-el="shell.nav-label"
          className="text-muted-foreground px-2.5 pt-2.5 pb-1 text-xs font-semibold tracking-[0.08em] uppercase"
        >
          {label}
        </div>
      ) : null}
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function NavItem({
  to,
  icon: Icon,
  label,
  exact,
}: {
  to: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  exact?: boolean;
}) {
  const matchRoute = useMatchRoute();
  const isActive = !!matchRoute({ to, fuzzy: !exact });

  return (
    <Link
      to={to}
      data-el="shell.sidebar-item"
      data-active={isActive ? "" : undefined}
      className={cn(
        // h-7 = 28px (디자인 실측). text-base 의 inherited line-height 때문에
        // py-[6px] 만 쓰면 32 가 되어 — 높이 고정 + 세로 가운데 정렬로 28 확보.
        "group/item flex h-7 items-center gap-2.5 rounded-md px-2.5 text-base leading-none transition-colors",
        isActive
          ? "bg-foreground/5 text-sidebar-foreground font-medium"
          : "text-sidebar-foreground hover:bg-muted hover:text-foreground font-normal",
      )}
    >
      <Icon className="text-sidebar-foreground/70 size-3.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </Link>
  );
}

/* Sync status indicator */

function SyncStatus() {
  const { t } = useFeatureTranslation("feature.story");
  return (
    <div className="text-muted-foreground flex min-w-0 items-center gap-1.5 font-mono text-xs">
      <Cloud className="text-muted-foreground/70 size-3.5" />
      <span>{t("shell.sync.cloud")}</span>
    </div>
  );
}
