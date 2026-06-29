import { Button } from "@repo/ui/shadcn/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@repo/ui/shadcn/dropdown-menu";
import { Bell, Settings } from "lucide-react";
import { useState } from "react";
import type { NotificationItem } from "../../common/types";
import { useUnreadCount } from "../hooks";
import { NotificationList } from "./notification-list";

interface NotificationDropdownProps {
  onSettingsClick?: () => void;
  onViewAllClick?: () => void;
  onItemClick?: (notification: NotificationItem) => void;
}

/**
 * 알림 드롭다운
 */
export function NotificationDropdown({
  onSettingsClick,
  onViewAllClick,
  onItemClick,
}: NotificationDropdownProps) {
  const [open, setOpen] = useState(false);
  const { data } = useUnreadCount();
  const unreadCount = data?.count ?? 0;

  const handleItemClick = (notification: NotificationItem) => {
    onItemClick?.(notification);
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="relative" />}>
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-2xs font-medium text-destructive-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="font-medium">알림</span>
          <Button variant="ghost" size="icon" onClick={onSettingsClick}>
            <Settings className="size-3.5" />
          </Button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          <NotificationList limit={10} onItemClick={handleItemClick} />
        </div>
        <div className="border-t px-3 py-2">
          <Button variant="ghost" size="sm" className="w-full" onClick={onViewAllClick}>
            전체 보기
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
