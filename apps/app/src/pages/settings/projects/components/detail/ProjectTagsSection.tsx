import { useFeatureTranslation } from "@repo/core/i18n";
import { DataTable, SettingItem } from "@repo/ui/settings";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";

interface Tag {
  id: string;
  name: string;
  description: string | null;
  createdAt: string | Date | null;
}

interface Props {
  tags: Tag[];
}

function buildColumns(t: (key: string) => string): ColumnDef<Tag, unknown>[] {
  return [
    {
      id: "name",
      header: t("projects.detail.tags.column.name"),
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      id: "description",
      header: t("projects.detail.tags.column.description"),
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.description ?? "—"}</span>
      ),
    },
    {
      id: "createdAt",
      header: t("projects.detail.tags.column.createdAt"),
      size: 130,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.createdAt
            ? new Date(row.original.createdAt).toISOString().slice(0, 10)
            : "—"}
        </span>
      ),
    },
  ];
}

export function ProjectTagsSection({ tags }: Props) {
  const { t } = useFeatureTranslation("page.settings");
  const columns = useMemo(() => buildColumns(t), [t]);
  return (
    <SettingItem
      title={t("projects.detail.tags.title", { count: tags.length })}
      description={t("projects.detail.tags.description")}
    >
      <DataTable<Tag>
        columns={columns}
        data={tags}
        maxHeight={400}
        empty={t("projects.detail.tags.empty")}
      />
    </SettingItem>
  );
}
