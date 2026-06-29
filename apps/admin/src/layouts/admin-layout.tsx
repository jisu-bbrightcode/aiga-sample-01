/**
 * Admin Layout - Admin 권한 유저용 레이아웃
 *
 * packages/ui의 공유 SidebarLayout 사용
 */

import { AdminGuard, authenticatedAtom, profileAtom, userRoleAtom } from "@repo/core/auth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@repo/ui/layouts/compact-sidebar";
import { SidebarLayout } from "@repo/ui/layouts/sidebar-layout";
import { SidebarUserFooter } from "@repo/ui/layouts/sidebar-user-footer";
import { DropdownMenuItem, DropdownMenuSeparator } from "@repo/ui/shadcn/dropdown-menu";
import { SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem } from "@repo/ui/shadcn/sidebar";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import {
  CreditCard,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Settings,
  ShieldCheck,
  User,
  Users,
  Video,
} from "lucide-react";
import { authClient } from "../lib/auth-client";
import { getLabels, project } from "../lib/project";

export function AdminLayout() {
  const navigate = useNavigate();
  const authenticated = useAtomValue(authenticatedAtom);
  const userRole = useAtomValue(userRoleAtom);

  const handleUnauthenticated = () => {
    navigate({ to: "/sign-in", replace: true });
  };

  const handleUnauthorized = () => {
    navigate({ to: "/sign-in", replace: true });
  };

  return (
    <AdminGuard
      authenticated={authenticated}
      userRole={userRole}
      onUnauthenticated={handleUnauthenticated}
      onUnauthorized={handleUnauthorized}
    >
      <SidebarLayout compact sidebar={<AdminSidebar />}>
        <Outlet />
      </SidebarLayout>
    </AdminGuard>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Components
 * -----------------------------------------------------------------------------------------------*/

function AdminSidebar() {
  const labels = getLabels();
  const user = useAtomValue(profileAtom);
  const navigate = useNavigate();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  const handleSignOut = async () => {
    await authClient.signOut();
    navigate({ to: "/sign-in", replace: true });
  };

  return (
    <Sidebar collapsible="icon">
      {/* Header */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton render={<Link to="/" />}>
              <Settings className="size-3.5" />
              <span className="font-semibold">
                {project.name} {labels.sidebarTitle}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Content */}
      <SidebarContent>
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>{labels.menuGroup}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link to="/" />} isActive={currentPath === "/"}>
                  <MessageSquare />
                  <span>Chat</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link to="/dashboard" />}
                  isActive={currentPath === "/dashboard"}
                >
                  <LayoutDashboard />
                  <span>{labels.dashboard}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link to="/users" />}
                  isActive={currentPath === "/users"}
                >
                  <Users />
                  <span>{labels.userManagement}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link to="/payment" />}
                  isActive={currentPath === "/payment" || currentPath.startsWith("/payment/")}
                >
                  <CreditCard />
                  <span>결제 관리</span>
                </SidebarMenuButton>
                {currentPath.startsWith("/payment") ? (
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        render={<Link to="/payment/subscribers" />}
                        isActive={currentPath.startsWith("/payment/subscribers")}
                      >
                        구독자
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        render={<Link to="/payment/orders" />}
                        isActive={currentPath.startsWith("/payment/orders")}
                      >
                        주문/환불
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        render={<Link to="/payment/inicis" />}
                        isActive={currentPath === "/payment/inicis"}
                      >
                        INICIS
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        render={<Link to="/payment/plans" />}
                        isActive={currentPath === "/payment/plans"}
                      >
                        플랜
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        render={<Link to="/payment/top-ups" />}
                        isActive={currentPath === "/payment/top-ups"}
                      >
                        Top-up
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        render={<Link to="/payment/pricing" />}
                        isActive={currentPath === "/payment/pricing"}
                      >
                        모델 가격
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        render={<Link to="/payment/coupons" />}
                        isActive={currentPath.startsWith("/payment/coupons")}
                      >
                        쿠폰
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        render={<Link to="/payment/audit" />}
                        isActive={currentPath === "/payment/audit"}
                      >
                        Audit Log
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                ) : null}
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link to="/identity-verification" />}
                  isActive={currentPath.startsWith("/identity-verification")}
                >
                  <ShieldCheck />
                  <span>본인확인</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link to="/video-lectures" />}
                  isActive={currentPath.startsWith("/video-lectures")}
                >
                  <Video />
                  <span>영상 강의</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer - User Menu */}
      <SidebarUserFooter
        user={{
          name: user?.name,
          email: user?.email,
          avatar: user?.avatar,
          planName: "Free",
        }}
        fallback={user?.name?.charAt(0)?.toUpperCase() ?? "A"}
        menuItems={
          <>
            <DropdownMenuItem>
              <Link to="/" className="cursor-pointer w-full flex items-center">
                <User className="mr-2 size-3.5" />
                {labels.profile}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Link to="/" className="cursor-pointer w-full">
                {labels.goToApp}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
              <LogOut className="mr-2 size-3.5" />
              {labels.logout}
            </DropdownMenuItem>
          </>
        }
      />

      <SidebarRail />
    </Sidebar>
  );
}
