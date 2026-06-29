/**
 * App Shell 01 - Compact Sidebar 레이아웃
 *
 * packages/ui의 공유 SidebarLayout 사용
 */

import { AuthGuard, authenticatedAtom, profileAtom } from "@repo/core/auth";
import LogoSvg from "@repo/ui/assets/svg/logo";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@repo/ui/layouts/compact-sidebar";
import { SidebarLayout } from "@repo/ui/layouts/sidebar-layout";
import { SidebarUserFooter } from "@repo/ui/layouts/sidebar-user-footer";
import { DropdownMenuItem, DropdownMenuSeparator } from "@repo/ui/shadcn/dropdown-menu";
import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import { LayoutDashboard, LogOut, Settings, User } from "lucide-react";
import { AppAuthLoadingState } from "@/components/app-loading";
import { authClient } from "../../lib/auth-client";
import { project } from "../../lib/project";

export function AppShell01() {
  const navigate = useNavigate();
  const authenticated = useAtomValue(authenticatedAtom);

  const handleUnauthenticated = () => {
    navigate({ to: "/sign-in" });
  };

  return (
    <AuthGuard
      authenticated={authenticated}
      onUnauthenticated={handleUnauthenticated}
      loadingFallback={<AppAuthLoadingState />}
    >
      <SidebarLayout compact sidebar={<AppSidebar />}>
        <Outlet />
      </SidebarLayout>
    </AuthGuard>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Components
 * -----------------------------------------------------------------------------------------------*/

function AppSidebar() {
  const user = useAtomValue(profileAtom);
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await authClient.signOut();
    navigate({ to: "/sign-in" });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link to="/" />}>
              <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <LogoSvg className="size-5" />
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-semibold">{project.name}</span>
                <span className="text-muted-foreground text-xs">Dashboard</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link to="/" />}>
                  <LayoutDashboard />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {/* [ATLAS:SIDEBAR_ITEMS] */}
              {/* [/ATLAS:SIDEBAR_ITEMS] */}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {/* [ATLAS:SIDEBAR_GROUPS] */}
        {/* [/ATLAS:SIDEBAR_GROUPS] */}
      </SidebarContent>

      <SidebarUserFooter
        user={{
          name: user?.name,
          email: user?.email,
          avatar: user?.avatar,
          planName: "Free",
        }}
        menuItems={
          <>
            <DropdownMenuItem>
              <Link to="/" className="flex w-full cursor-pointer items-center">
                <User className="mr-2 size-3.5" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Link to="/settings" className="flex w-full cursor-pointer items-center">
                <Settings className="mr-2 size-3.5" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
              <LogOut className="mr-2 size-3.5" />
              Sign Out
            </DropdownMenuItem>
          </>
        }
      />
    </Sidebar>
  );
}
