/**
 * SettingsSidebar — context-aware settings nav.
 * Active matching uses location.pathname (TanStack Router useMatchRoute
 * fails when the layout sits directly under rootRoute outside the
 * appLayout context).
 */
import { useFeatureTranslation } from "@repo/core/i18n";
import { SettingsSidebarNav, type SettingsSidebarNavGroup } from "@repo/ui/settings";
import { Link, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";

interface SectionItem {
  path: string;
  labelKey?: string;
  label?: ReactNode;
  match?: "exact" | "fuzzy";
  activePaths?: string[];
  search?: { projectId: string };
}

interface SectionGroup {
  labelKey: string;
  items: SectionItem[];
}

const PERSONAL_GROUP: SectionGroup = {
  labelKey: "sidebar.group.personal",
  items: [
    { path: "/settings/profile", labelKey: "sidebar.item.profile", activePaths: ["/settings"] },
    { path: "/settings/security", labelKey: "sidebar.item.security" },
    { path: "/settings/notifications", labelKey: "sidebar.item.notifications" },
  ],
};

const ORGANIZATION_GROUP: SectionGroup = {
  labelKey: "sidebar.group.organization",
  items: [
    { path: "/settings/organization", labelKey: "sidebar.item.organization" },
    { path: "/settings/organization/members", labelKey: "sidebar.item.members" },
  ],
};

const BILLING_GROUP: SectionGroup = {
  labelKey: "sidebar.group.billing",
  items: [
    { path: "/settings/billing", labelKey: "sidebar.item.billing" },
    { path: "/settings/coupons", labelKey: "sidebar.item.coupons" },
  ],
};

const WORKSPACE_GROUPS: SectionGroup[] = [PERSONAL_GROUP, ORGANIZATION_GROUP, BILLING_GROUP];

function withProjectSearch(group: SectionGroup, projectId: string): SectionGroup {
  return {
    ...group,
    items: group.items.map(({ activePaths: _activePaths, ...item }) => ({
      ...item,
      search: { projectId },
    })),
  };
}

function isItemActive(pathname: string, item: SectionItem): boolean {
  if (item.activePaths?.includes(pathname)) {
    return true;
  }
  if (item.match === "fuzzy") {
    return pathname === item.path || pathname.startsWith(`${item.path}/`);
  }
  return pathname === item.path;
}

interface SettingsSidebarProps {
  projectId?: string;
  currentProjectName?: string | null;
}

export function SettingsSidebar({ projectId, currentProjectName }: SettingsSidebarProps = {}) {
  const { pathname } = useLocation();
  const { t } = useFeatureTranslation("page.settings");
  const sectionGroups: SectionGroup[] = projectId
    ? [
        withProjectSearch(PERSONAL_GROUP, projectId),
        withProjectSearch(ORGANIZATION_GROUP, projectId),
        {
          labelKey: "sidebar.group.projects",
          items: [
            {
              path: "/settings",
              label: currentProjectName ?? t("sidebar.item.currentProject"),
              search: { projectId },
            },
          ],
        },
        withProjectSearch(BILLING_GROUP, projectId),
      ]
    : WORKSPACE_GROUPS;
  const groups: SettingsSidebarNavGroup[] = sectionGroups.map((group) => ({
    id: group.labelKey,
    label: t(group.labelKey),
    items: group.items.map((item) => ({
      id: item.path,
      label: item.label ?? t(item.labelKey ?? ""),
      active: isItemActive(pathname, item),
      search: item.search,
    })),
  }));

  return (
    <SettingsSidebarNav
      groups={groups}
      renderItem={(item, className) => {
        const search = (item as { search?: { projectId: string } }).search;
        return (
          <Link
            key={item.id}
            to={item.id}
            search={search}
            replace
            data-active={item.active ? "true" : undefined}
            className={className}
          >
            {item.label}
          </Link>
        );
      }}
    />
  );
}
