/**
 * Sidebar User Footer — 사이드바 하단 유저 메뉴
 *
 * Avatar + 이름/이메일 표시 + DropdownMenu
 * menuItems를 ReactNode로 받아 앱별 Link/onClick 자유 구성
 */
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/shadcn/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@repo/ui/shadcn/dropdown-menu";
import { ChevronUp } from "lucide-react";
import { SidebarFooter, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "./compact-sidebar";

/* -------------------------------------------------------------------------------------------------
 * Types
 * -----------------------------------------------------------------------------------------------*/

interface SidebarUserFooterProps {
  /** 사용자 정보 */
  user: {
    name?: string | null;
    email?: string | null;
    avatar?: string | null;
    planName?: string | null;
  };
  /** DropdownMenuContent 내부에 렌더링할 메뉴 아이템들 */
  menuItems?: React.ReactNode;
  /** 아바타 fallback 텍스트 (기본: 이름 첫 글자) */
  fallback?: string;
}

/* -------------------------------------------------------------------------------------------------
 * Component
 * -----------------------------------------------------------------------------------------------*/

export function SidebarUserFooter({ user, menuItems, fallback }: SidebarUserFooterProps) {
  const displayFallback = fallback ?? user.name?.charAt(0)?.toUpperCase() ?? "U";

  return (
    <SidebarFooter>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <SidebarMenuButton
              render={<DropdownMenuTrigger />}
              size="lg"
              className="data-[state=open]:bg-secondary data-[state=open]:text-secondary-foreground"
            >
              <Avatar className="size-8 rounded-lg">
                <AvatarImage src={user.avatar ?? undefined} />
                <AvatarFallback className="rounded-lg">{displayFallback}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{user.name ?? "User"}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {user.planName ?? user.email ?? ""}
                </span>
              </div>
              <ChevronUp className="ml-auto size-3.5" />
            </SidebarMenuButton>
            {menuItems && (
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="top"
                align="end"
                sideOffset={4}
              >
                {menuItems}
              </DropdownMenuContent>
            )}
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  );
}
