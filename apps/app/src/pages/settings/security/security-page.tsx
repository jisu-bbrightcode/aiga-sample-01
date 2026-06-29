import { useFeatureTranslation } from "@repo/core/i18n";
import { EmptyComingSoon } from "@repo/ui/settings";
import { ShieldCheck } from "lucide-react";
import { SettingPageLayout } from "../_shared/SettingPageLayout";

export function SecurityPage() {
  const { t } = useFeatureTranslation("page.settings");
  return (
    <SettingPageLayout title={t("security.title")}>
      <EmptyComingSoon
        icon={<ShieldCheck />}
        title={t("security.placeholder.title")}
        description={t("security.placeholder.description")}
      />
    </SettingPageLayout>
  );
}
