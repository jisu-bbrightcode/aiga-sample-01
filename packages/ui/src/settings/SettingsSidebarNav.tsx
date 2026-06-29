import type { ReactNode } from "react";
import { cn } from "../lib/utils";

export interface SettingsSidebarNavItem {
  id: string;
  label: ReactNode;
  active?: boolean;
  disabled?: boolean;
}

export interface SettingsSidebarNavGroup {
  id: string;
  label: ReactNode;
  items: SettingsSidebarNavItem[];
}

interface SettingsSidebarNavProps {
  groups: SettingsSidebarNavGroup[];
  className?: string;
  renderItem: (item: SettingsSidebarNavItem, className: string) => ReactNode;
}

export const settingsSidebarItemClassName =
  "flex h-8 w-full items-center rounded-md px-2.5 text-sm text-foreground transition-colors hover:bg-muted hover:text-foreground data-[active=true]:bg-secondary data-[active=true]:font-medium data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50";

export function SettingsSidebarNav({
  groups,
  className,
  renderItem,
}: SettingsSidebarNavProps) {
  return (
    <nav
      data-slot="settings-sidebar-nav"
      className={cn("w-[220px] shrink-0 overflow-y-auto px-3 pb-6 pt-4", className)}
    >
      {groups.map((group) => (
        <div key={group.id} className="mb-4">
          <div className="px-2.5 pb-1 pt-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {group.label}
          </div>
          <div className="flex flex-col gap-px">
            {group.items.map((item) =>
              renderItem(
                item,
                cn(settingsSidebarItemClassName, item.active && "bg-secondary font-medium"),
              ),
            )}
          </div>
        </div>
      ))}
    </nav>
  );
}
