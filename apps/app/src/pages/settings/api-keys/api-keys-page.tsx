import { useFeatureTranslation } from "@repo/core/i18n";
import { EmptyComingSoon } from "@repo/ui/settings";
import { KeyRound } from "lucide-react";
import { SettingPageLayout } from "../_shared/SettingPageLayout";

export function ApiKeysPage() {
  const { t } = useFeatureTranslation("page.settings");
  return (
    <SettingPageLayout title={t("apiKeys.title")}>
      <EmptyComingSoon
        icon={<KeyRound />}
        title={t("apiKeys.placeholder.title")}
        description={t("apiKeys.placeholder.description")}
      />
    </SettingPageLayout>
  );
}
