import { useFeatureTranslation } from "@repo/core/i18n";
import { DataTable, Pill, SettingItem } from "@repo/ui/settings";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";

interface Language {
  id: string;
  code: string;
  name: string;
  isSource: boolean;
  progress: number;
}

interface Props {
  languages: Language[];
}

function buildColumns(t: (key: string) => string): ColumnDef<Language, unknown>[] {
  return [
    {
      id: "name",
      header: t("projects.detail.languages.column.name"),
      cell: ({ row }) => {
        const l = row.original;
        return (
          <div className="flex items-center gap-2">
            <span className="font-medium">{l.name}</span>
            <span className="text-muted-foreground">{l.code}</span>
            {l.isSource ? <Pill tone="info">{t("projects.detail.languages.source")}</Pill> : null}
          </div>
        );
      },
    },
    {
      id: "progress",
      header: t("projects.detail.languages.column.progress"),
      size: 100,
      cell: ({ row }) => <span>{row.original.progress}%</span>,
    },
  ];
}

export function ProjectLanguagesSection({ languages }: Props) {
  const { t } = useFeatureTranslation("page.settings");
  const columns = useMemo(() => buildColumns(t), [t]);
  return (
    <SettingItem
      title={t("projects.detail.languages.title", { count: languages.length })}
      description={t("projects.detail.languages.description")}
    >
      <DataTable<Language>
        columns={columns}
        data={languages}
        empty={t("projects.detail.languages.empty")}
      />
    </SettingItem>
  );
}
