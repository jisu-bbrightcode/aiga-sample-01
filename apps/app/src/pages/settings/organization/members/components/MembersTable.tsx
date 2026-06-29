import { useFeatureTranslation } from "@repo/core/i18n";
import { DataTable, HueAvatar, Pill } from "@repo/ui/settings";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import { displayRole } from "../role-display";

interface ActiveRow {
  status: "active" | "agent" | "inactive";
  id: string;
  name: string;
  handle: string | null;
  email: string;
  role: string;
  avatar?: string | null;
  hue?: number;
  online?: boolean;
  lastSeen?: string;
  joinedAt?: string;
  inviter?: string;
}
interface PendingRow {
  status: "pending";
  id: string;
  email: string;
  role: string;
  inviter: string;
  invitedAt: string;
}

export type MemberRow = ActiveRow | PendingRow;

export interface MemberGroup {
  label: string;
  rows: MemberRow[];
}

function buildColumns(t: (key: string) => string): ColumnDef<MemberRow, unknown>[] {
  return [
    {
      id: "name",
      header: t("members.column.name"),
      cell: ({ row }) => {
        const r = row.original;
        if (r.status === "pending") {
          return (
            <div className="flex items-center gap-3">
              <HueAvatar email={r.email} size="sm" />
              <span className="font-medium">{r.email}</span>
            </div>
          );
        }
        return (
          <div className="flex items-center gap-3">
            <HueAvatar
              name={r.name}
              email={r.email}
              hue={r.hue}
              src={r.avatar ?? undefined}
              size="sm"
            />
            <div className="flex flex-col leading-tight">
              <span className="font-medium">{r.name}</span>
              {r.handle ? <span className="text-xs text-muted-foreground">@{r.handle}</span> : null}
            </div>
          </div>
        );
      },
    },
    {
      id: "email",
      header: t("members.column.email"),
      cell: ({ row }) => {
        const r = row.original;
        if (r.status === "pending")
          return <span className="text-muted-foreground">{t("members.cell.invitationSent")}</span>;
        return <span className="text-muted-foreground">{r.email}</span>;
      },
    },
    {
      id: "status",
      header: t("members.column.status"),
      size: 110,
      cell: ({ row }) => {
        const r = row.original;
        if (r.status === "pending")
          return <Pill tone="warning">{t("members.cell.pendingPill")}</Pill>;
        if (r.status === "agent") return <Pill tone="info">{displayRole(r.role)}</Pill>;
        if (r.status === "inactive") return <Pill tone="neutral">{displayRole(r.role)}</Pill>;
        return <span>{displayRole(r.role)}</span>;
      },
    },
    {
      id: "inviter",
      header: t("members.column.inviter"),
      size: 110,
      cell: ({ row }) => {
        const r = row.original;
        if (r.status === "pending")
          return <span className="text-muted-foreground">{r.inviter || "—"}</span>;
        if (r.role === "owner")
          return <span className="text-muted-foreground">{t("members.cell.inviterAll")}</span>;
        return <span className="text-muted-foreground">—</span>;
      },
    },
    {
      id: "joinedAt",
      header: t("members.column.joinedAt"),
      size: 100,
      cell: ({ row }) => {
        const r = row.original;
        if (r.status === "pending") return <span className="text-muted-foreground">—</span>;
        return <span className="text-muted-foreground">{r.joinedAt ?? "—"}</span>;
      },
    },
    {
      id: "lastSeen",
      header: t("members.column.lastSeen"),
      size: 130,
      cell: ({ row }) => {
        const r = row.original;
        if (r.status === "pending")
          return <span className="text-muted-foreground">{r.invitedAt || "—"}</span>;
        if (r.online) {
          return (
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <span className="size-2 rounded-full bg-emerald-500" />
              Online
            </span>
          );
        }
        return <span className="text-muted-foreground">{r.lastSeen ?? "—"}</span>;
      },
    },
  ];
}

interface Props {
  groups: MemberGroup[];
}

export function MembersTable({ groups }: Props) {
  const { t } = useFeatureTranslation("page.settings");
  const columns = useMemo(() => buildColumns(t), [t]);
  return (
    <DataTable
      columns={columns}
      groups={groups.filter((g) => g.rows.length > 0)}
      empty={t("members.empty")}
    />
  );
}
