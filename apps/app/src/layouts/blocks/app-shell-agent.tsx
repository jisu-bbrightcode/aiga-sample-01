/**
 * App Shell Agent — Warm Studio SaaS 레이아웃
 *
 * 따뜻한 베이지 사이드바 + 깨끗한 화이트 메인 영역
 * 레퍼런스: Codex/OpenAI 스타일 SaaS 대시보드
 */

import { AuthGuard, authenticatedAtom, profileAtom } from "@repo/core/auth";
import LogoSvg from "@repo/ui/assets/svg/logo";
import { cn } from "@repo/ui/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/shadcn/avatar";
import { Button } from "@repo/ui/shadcn/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/shadcn/dropdown-menu";
import { Link, Outlet, useMatchRoute, useNavigate } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import {
  ArrowLeft,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  User,
  Users,
} from "lucide-react";
import { useState } from "react";
import { AppAuthLoadingState } from "@/components/app-loading";
import { authClient } from "../../lib/auth-client";
import { project } from "../../lib/project";

export function AppShellAgent() {
  const navigate = useNavigate();
  const authenticated = useAtomValue(authenticatedAtom);
  const matchRoute = useMatchRoute();
  const isCommunity =
    Boolean(matchRoute({ to: "/communities", fuzzy: true })) ||
    Boolean(matchRoute({ to: "/home", fuzzy: false })) ||
    Boolean(matchRoute({ to: "/c/$slug", fuzzy: true }));
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleUnauthenticated = () => {
    navigate({ to: "/sign-in" });
  };

  return (
    <AuthGuard
      authenticated={authenticated}
      onUnauthenticated={handleUnauthenticated}
      loadingFallback={<AppAuthLoadingState />}
    >
      <div className="flex h-full min-h-0 flex-1 overflow-hidden bg-background">
        {/* Sidebar — hidden in community section */}
        {isCommunity ? null : (
          <WarmSidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        )}

        {/* Main */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <MainHeader
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            isCommunity={isCommunity}
          />
          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Components
 * -----------------------------------------------------------------------------------------------*/

interface WarmSidebarProps {
  open: boolean;
  onToggle: () => void;
}

function WarmSidebar({ open, onToggle }: WarmSidebarProps) {
  const user = useAtomValue(profileAtom);
  const navigate = useNavigate();
  const matchRoute = useMatchRoute();
  const isDashboard = Boolean(matchRoute({ to: "/", fuzzy: false }));
  const isCommunity =
    Boolean(matchRoute({ to: "/communities", fuzzy: true })) ||
    Boolean(matchRoute({ to: "/home", fuzzy: false })) ||
    Boolean(matchRoute({ to: "/c/$slug", fuzzy: true }));

  const handleSignOut = async () => {
    await authClient.signOut();
    navigate({ to: "/" });
  };

  return (
    <aside
      className={cn(
        "flex h-full flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out",
        open ? "w-[280px]" : "w-0 overflow-hidden border-r-0",
      )}
    >
      {/* Sidebar Header */}
      <div className="flex h-11 shrink-0 items-center justify-between px-4">
        <Button
          variant="ghost"
          onClick={() => navigate({ to: "/" })}
          className="flex items-center gap-2.5 rounded-lg px-1 py-1 transition-colors hover:opacity-80"
        >
          <div className="flex size-7 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <LogoSvg className="size-4" />
          </div>
          <span className="text-lg font-semibold tracking-tight text-sidebar-foreground">
            {project.name}
          </span>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="size-7 text-sidebar-foreground/50 hover:bg-muted hover:text-foreground"
          title="사이드바 접기"
        >
          <PanelLeftClose className="size-3.5" />
        </Button>
      </div>

      {/* New Action */}
      <div className="px-3 pb-2">
        <Button
          variant="outline"
          className="w-full justify-start gap-2 border-none bg-transparent text-sidebar-foreground/70 hover:bg-muted hover:text-foreground h-9 text-base shadow-none"
        >
          <Plus className="size-3.5" />새 프로젝트
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {/* Main Nav */}
        <div className="mb-4">
          <SidebarNavItem
            to="/"
            icon={<LayoutDashboard className="size-3.5" />}
            label="대시보드"
            active={isDashboard}
          />
          <SidebarNavItem
            to="/communities"
            icon={<Users className="size-3.5" />}
            label="커뮤니티"
            active={isCommunity}
          />
          {/* [ATLAS:SIDEBAR_ITEMS] */}
          {/* [/ATLAS:SIDEBAR_ITEMS] */}
        </div>

        {/* [ATLAS:SIDEBAR_GROUPS] */}
        {/* [/ATLAS:SIDEBAR_GROUPS] */}
      </nav>

      {/* Sidebar Footer */}
      <div className="shrink-0 p-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-muted hover:text-foreground"
              />
            }
          >
            <Avatar className="size-7">
              <AvatarImage src={user?.avatar ?? undefined} />
              <AvatarFallback className="bg-secondary text-xs font-medium text-secondary-foreground">
                {user?.name?.charAt(0)?.toUpperCase() ?? "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-1 flex-col text-left leading-tight">
              <span className="truncate text-base font-medium text-sidebar-foreground">
                {user?.name ?? "User"}
              </span>
              <span className="truncate text-xs text-sidebar-foreground/45">
                {user?.email ?? ""}
              </span>
            </div>
            <Settings className="size-3.5 text-sidebar-foreground/30" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuItem className="cursor-pointer gap-2">
              <User className="size-3.5" />
              프로필
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer gap-2">
              <Link to="/settings" className="flex w-full items-center gap-2">
                <Settings className="size-3.5" />
                설정
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer gap-2">
              <LogOut className="size-3.5" />
              로그아웃
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}

/* Sidebar Nav Item */

function SidebarNavItem({
  to,
  icon,
  label,
  active = false,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-base font-medium transition-colors",
        active
          ? "bg-secondary text-secondary-foreground"
          : "text-sidebar-foreground/60 hover:bg-muted hover:text-foreground",
      )}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

/* Main Header */

interface MainHeaderProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  isCommunity: boolean;
}

function MainHeader({ sidebarOpen, onToggleSidebar, isCommunity }: MainHeaderProps) {
  const matchRoute = useMatchRoute();
  const navigate = useNavigate();
  const title = (() => {
    if (matchRoute({ to: "/communities/create" })) return "커뮤니티 만들기";
    if (matchRoute({ to: "/communities", fuzzy: false })) return "커뮤니티";
    if (matchRoute({ to: "/home", fuzzy: false })) return "홈 피드";
    if (matchRoute({ to: "/c/$slug", fuzzy: true })) return "커뮤니티";
    return "대시보드";
  })();

  return (
    <header className="flex h-11 shrink-0 items-center border-b border-border px-4">
      {isCommunity ? (
        <Button
          variant="ghost"
          onClick={() => navigate({ to: "/" })}
          className="mr-2 h-8 gap-1.5 px-2 text-base text-muted-foreground hover:bg-muted hover:text-foreground"
          title="작업공간으로 돌아가기"
        >
          <ArrowLeft className="size-3.5" />
          <span>작업공간</span>
        </Button>
      ) : sidebarOpen ? null : (
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          className="mr-3 size-8 text-muted-foreground hover:bg-muted hover:text-foreground"
          title="사이드바 열기"
        >
          <PanelLeftOpen className="size-3.5" />
        </Button>
      )}

      <h1 className="text-lg font-semibold text-foreground">{title}</h1>

      <div className="flex-1" />

      {/* Right Actions */}
      <div className="flex items-center gap-1">
        {/* [ATLAS:HEADER_ACTIONS] */}
        {/* [/ATLAS:HEADER_ACTIONS] */}
      </div>
    </header>
  );
}
