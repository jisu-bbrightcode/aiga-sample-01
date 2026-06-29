/**
 * AppShellWrapper — Shared app shell sidebar + main area wrapper
 *
 * Extracts the common 200px sidebar (logo, search, nav items) from app-shell.tsx.
 * Templates wrap their content with this component to get a consistent app shell.
 */

import { cn } from "~/lib/utils";

interface AppShellWrapperProps {
  children: React.ReactNode;
  activeItem?: string;
  className?: string;
}

export function AppShellWrapper({
  children,
  activeItem = "세계",
  className,
}: AppShellWrapperProps) {
  return (
    <div
      className={cn("flex h-screen", className)}
      style={{ backgroundColor: "rgba(0, 0, 0, 0.04)" }}
    >
      {/* Sidebar — 200px, bg var(--bg), padding 16px 8px per HTML standard */}
      <aside
        className="flex w-[200px] shrink-0 flex-col overflow-y-auto"
        style={{ backgroundColor: "rgb(250, 250, 250)", padding: "16px 8px" }}
        data-testid="shell.sidebar"
      >
        {/* Logo + Avatar — mb 24px per HTML .shell-sidebar-logo */}
        <div
          className="flex items-center justify-between"
          style={{ padding: "0 8px", marginBottom: "24px" }}
        >
          <div className="flex items-center" style={{ gap: "6px" }}>
            <div className="flex h-[20px] w-[20px] items-center justify-center">
              <div
                className="flex h-[20px] w-[20px] items-center justify-center rounded-[4px] text-2xs font-bold"
                style={{ backgroundColor: "rgb(23, 23, 23)", color: "rgb(255, 255, 255)" }}
              >
                F
              </div>
            </div>
            <span
              style={{
                fontSize: "14px",
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: "rgb(23, 23, 23)",
              }}
            >
              Product Builder
            </span>
          </div>
          <div
            className="flex h-[22px] w-[22px] items-center justify-center rounded-full text-base font-semibold"
            style={{ backgroundColor: "rgb(235, 235, 235)", color: "rgb(82, 82, 82)" }}
          >
            B
          </div>
        </div>

        {/* Search — mb 8px */}
        <button
          type="button"
          className="flex items-center rounded-[6px] text-base"
          style={{
            padding: "4px 8px",
            color: "rgb(163, 163, 163)",
            marginBottom: "8px",
            gap: "8px",
          }}
          data-testid="shell.search"
        >
          <span>검색...</span>
          <span
            className="ml-auto"
            style={{
              fontFamily: "'Geist Mono', 'SF Mono', monospace",
              fontSize: "13px",
              color: "rgb(163, 163, 163)",
              backgroundColor: "rgb(235, 235, 235)",
              padding: "1px 4px",
              borderRadius: "3px",
            }}
          >
            ⌘K
          </span>
        </button>

        {/* Draft — with margin 4px 0 per HTML */}
        <div style={{ margin: "4px 0" }}>
          <SidebarItem
            icon={<PenLineIcon />}
            label="초안"
            count={2}
            isActive={activeItem === "초안"}
          />
        </div>

        {/* Section: 세계관 — no divider line, just section label with top padding */}
        <SidebarSectionLabel>세계관</SidebarSectionLabel>
        <SidebarItem icon={<GlobeIcon />} label="세계" count={3} isActive={activeItem === "세계"} />
        <SidebarItem
          icon={<UserIcon />}
          label="캐릭터"
          count={3}
          isActive={activeItem === "캐릭터"}
        />
        <SidebarItem
          icon={<MapPinIcon />}
          label="장소"
          count={3}
          isActive={activeItem === "장소"}
        />
        <SidebarItem
          icon={<ShieldIcon />}
          label="세력"
          count={2}
          isActive={activeItem === "세력"}
        />

        {/* Section: 도구 */}
        <SidebarSectionLabel>도구</SidebarSectionLabel>
        <SidebarItem icon={<LanguagesIcon />} label="현지화" isActive={activeItem === "현지화"} />

        {/* Spacer */}
        <div className="flex-1" />

        {/* Settings */}
        <SidebarItem icon={<SettingsIcon />} label="설정" isActive={activeItem === "설정"} />
      </aside>

      {/* Main — bg var(--bg) */}
      <main
        className="flex flex-1 min-w-0 overflow-hidden"
        style={{ backgroundColor: "rgb(250, 250, 250)" }}
        data-testid="shell.main"
      >
        {children}
      </main>
    </div>
  );
}

/* Components */

function SidebarSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="uppercase"
      style={{
        fontSize: "12px",
        fontWeight: 400,
        color: "rgb(163, 163, 163)",
        letterSpacing: "0.08em",
        padding: "8px 8px 4px",
      }}
    >
      {children}
    </div>
  );
}

function SidebarItem({
  icon,
  label,
  count,
  isActive = false,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  isActive?: boolean;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center rounded-[6px] text-base"
      style={{
        padding: "4px 8px",
        gap: "8px",
        backgroundColor: isActive ? "rgb(245, 245, 245)" : "transparent",
        color: isActive ? "rgb(23, 23, 23)" : "rgb(82, 82, 82)",
        fontWeight: isActive ? 600 : 400,
      }}
    >
      <span className="flex h-[14px] w-[14px] shrink-0 items-center justify-center">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {count !== undefined && (
        <span
          style={{
            fontFamily: "'Geist Mono', 'SF Mono', monospace",
            fontSize: "13px",
            color: "rgb(163, 163, 163)",
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/* Icons */

function PenLineIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20h9" />
      <path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </svg>
  );
}

function LanguagesIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 8 6 6" />
      <path d="m4 14 6-6 2-3" />
      <path d="M2 5h12" />
      <path d="M7 2h1" />
      <path d="m22 22-5-10-5 10" />
      <path d="M14 18h6" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
