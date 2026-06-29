import { useFeatureTranslation } from "@repo/core/i18n";
import { Pill, SettingItem } from "@repo/ui/settings";

interface Props {
  visibility: "private" | "org" | "public";
}

const VIS_NAME = { private: "Private", org: "Org", public: "Public" } as const;
const VIS_LABEL_KEY = {
  private: "projects.detail.visibility.private",
  org: "projects.detail.visibility.org",
  public: "projects.detail.visibility.public",
} as const;

export function ProjectVisibilitySection({ visibility }: Props) {
  const { t } = useFeatureTranslation("page.settings");
  return (
    <SettingItem
      title={t("projects.detail.visibility.title")}
      description={t("projects.detail.visibility.description")}
    >
      <div className="flex items-center gap-2">
        <Pill
          tone={visibility === "private" ? "neutral" : visibility === "org" ? "info" : "success"}
        >
          {VIS_NAME[visibility]}
        </Pill>
        <span className="text-sm text-muted-foreground">
          {`${VIS_NAME[visibility]} — ${t(VIS_LABEL_KEY[visibility])}`}
        </span>
      </div>
    </SettingItem>
  );
}
