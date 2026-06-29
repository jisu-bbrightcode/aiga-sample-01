import { useFeatureTranslation } from "@repo/core/i18n";
import { Pill, SettingItem } from "@repo/ui/settings";

interface Props {
  org: string;
  handle: string | null;
  projectId: string;
}

export function ProjectHandleReadOnly({ org, handle, projectId }: Props) {
  const display = handle ?? projectId.slice(0, 8);
  const { t } = useFeatureTranslation("page.settings");
  return (
    <SettingItem
      title={t("projects.detail.handle.title")}
      description={t("projects.detail.handle.description")}
    >
      <div className="flex items-center gap-3">
        <span className="font-mono text-base text-foreground">
          product-builder.app/{org}/{display}
        </span>
        <Pill tone="neutral">read-only</Pill>
      </div>
    </SettingItem>
  );
}
