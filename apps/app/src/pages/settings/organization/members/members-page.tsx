/**
 * /settings/organization/members — Phase 3 members page.
 *
 * Layout: toolbar + 2–4 group tables (활성 / 초대 대기 / Agent / 비활성).
 * Filters apply across all groups; the visible groups are filtered down
 * accordingly (e.g. filter='admins' hides 초대 대기/agents/inactive).
 */
import { authClient } from "@repo/core/auth/client";
import { useFeatureTranslation } from "@repo/core/i18n";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { SettingPageLayout } from "../../_shared/SettingPageLayout";
import { $api, getOrganizationMembersQueryKey } from "../../api";
import { InviteDialog } from "./components/InviteDialog";
import type { MemberGroup } from "./components/MembersTable";
import { type MemberRow, MembersTable } from "./components/MembersTable";
import { type MembersFilter, MembersToolbar } from "./components/MembersToolbar";

interface EnrichedMember {
  id: string;
  userId: string;
  role: string;
  createdAt: string | Date;
  name: string | null;
  email: string | null;
  handle: string | null;
  avatar: string | null;
}
interface EnrichedInvitation {
  id: string;
  email: string;
  role: string | null;
  status: string;
  inviterId: string;
  inviterName: string | null;
  inviterEmail: string | null;
}

function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function downloadCSV(rows: MemberRow[]) {
  const lines = ["status,id,email,role"];
  for (const r of rows) {
    if (r.status === "pending") {
      lines.push(["pending", r.id, r.email, r.role].map(csvEscape).join(","));
    } else {
      lines.push([r.status, r.id, r.email, r.role].map(csvEscape).join(","));
    }
  }
  // UTF-8 BOM so Excel/Korean tools render correctly.
  const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `members-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function MembersPage() {
  const qc = useQueryClient();
  const { data: session } = authClient.useSession();
  const activeOrgId = session?.session?.activeOrganizationId;
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<MembersFilter>("all");
  const [inviteOpen, setInviteOpen] = useState(false);
  const { t } = useFeatureTranslation("page.settings");

  const list = $api.useQuery(
    "get",
    "/api/organization-settings/{organizationId}/members",
    {
      params: { path: { organizationId: activeOrgId ?? "" } },
    },
    { enabled: !!activeOrgId },
  );

  const groups = useMemo(() => {
    const data = list.data;
    if (!data) return { active: [], pending: [], agents: [], inactive: [] };
    const members = (data.members ?? []) as EnrichedMember[];
    const pending = (data.pending ?? []) as EnrichedInvitation[];

    const active: MemberRow[] = members.map((m) => ({
      status: "active",
      id: m.id,
      name: m.name ?? m.email ?? m.userId,
      handle: m.handle,
      email: m.email ?? "",
      role: m.role,
      avatar: m.avatar,
    }));

    const pendingRows: MemberRow[] = pending.map((p) => ({
      status: "pending",
      id: p.id,
      email: p.email,
      role: p.role ?? "member",
      inviter: p.inviterName ?? p.inviterEmail ?? p.inviterId,
      invitedAt: "",
    }));

    return { active, pending: pendingRows, agents: [], inactive: [] };
  }, [list.data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    function match(r: MemberRow) {
      if (!q) return true;
      const haystack = r.status === "pending" ? r.email : `${r.name} ${r.email} ${r.handle ?? ""}`;
      return haystack.toLowerCase().includes(q);
    }
    return {
      active: groups.active.filter(match),
      pending: groups.pending.filter(match),
      agents: groups.agents.filter(match),
      inactive: groups.inactive.filter(match),
    };
  }, [groups, search]);

  function exportCSV() {
    downloadCSV([
      ...filtered.active,
      ...filtered.pending,
      ...filtered.agents,
      ...filtered.inactive,
    ]);
  }

  if (!activeOrgId) {
    return (
      <SettingPageLayout title={t("members.title")}>
        <p className="text-sm text-muted-foreground">{t("organization.noActive")}</p>
      </SettingPageLayout>
    );
  }

  const showActive = filter === "all" || filter === "admins";
  const showPending = filter === "all" || filter === "pending";
  const showAgents = filter === "all" || filter === "agents";
  const showInactive = filter === "all";

  // 'admins' filter narrows the active group to admin/owner only.
  const visibleActive =
    filter === "admins"
      ? filtered.active.filter((r) => r.role === "admin" || r.role === "owner")
      : filtered.active;

  return (
    <SettingPageLayout
      title={t("members.title")}
      toolbar={
        <MembersToolbar
          search={search}
          onSearchChange={setSearch}
          filter={filter}
          onFilterChange={setFilter}
          onExport={exportCSV}
          onInvite={() => setInviteOpen(true)}
        />
      }
    >
      <MembersTable
        groups={[
          ...(showActive
            ? [{ label: t("members.group.active"), rows: visibleActive } satisfies MemberGroup]
            : []),
          ...(showPending
            ? [
                {
                  label: t("members.group.pending"),
                  rows: filtered.pending,
                } satisfies MemberGroup,
              ]
            : []),
          ...(showAgents
            ? [
                {
                  label: t("members.group.agents"),
                  rows: filtered.agents,
                } satisfies MemberGroup,
              ]
            : []),
          ...(showInactive
            ? [
                {
                  label: t("members.group.inactive"),
                  rows: filtered.inactive,
                } satisfies MemberGroup,
              ]
            : []),
        ]}
      />

      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        organizationId={activeOrgId}
        onInvited={() =>
          qc.invalidateQueries({
            queryKey: getOrganizationMembersQueryKey(activeOrgId),
          })
        }
      />
    </SettingPageLayout>
  );
}
