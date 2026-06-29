/**
 * DetailPageWrapper — AppShell + paper card layout for detail pages
 *
 * Combines:
 * 1. AppShellWrapper (left sidebar 200px)
 * 2. Content area with paper card design (white card on muted bg)
 * 3. Optional meta sidebar (right side, 240px)
 */

import { cn } from "~/lib/utils";
import { AppShellWrapper } from "./app-shell-wrapper";

interface DetailPageWrapperProps {
  activeItem?: string;
  children: React.ReactNode;
  metaSidebar?: React.ReactNode;
  className?: string;
}

export function DetailPageWrapper({
  activeItem = "세계",
  children,
  metaSidebar,
  className,
}: DetailPageWrapperProps) {
  return (
    <AppShellWrapper activeItem={activeItem} className={cn(className)}>
      {metaSidebar ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 240px",
            gap: "1px",
            overflow: "hidden",
            flex: 1,
          }}
        >
          <div style={{ flex: 1, minHeight: "100%", marginLeft: "4px", padding: "0" }}>
            <div
              style={{
                backgroundColor: "rgb(255, 255, 255)",
                padding: "24px",
                borderRadius: "12px 12px 14px",
                height: "100%",
                boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
              }}
            >
              {children}
            </div>
          </div>
          {metaSidebar}
        </div>
      ) : (
        <div style={{ flex: 1, overflow: "auto" }}>{children}</div>
      )}
    </AppShellWrapper>
  );
}
