import { useFeatureTranslation } from "@repo/core/i18n";
import { EmptyComingSoon } from "@repo/ui/settings";
import { Globe2 } from "lucide-react";
import { SettingPageLayout } from "../_shared/SettingPageLayout";

export function SsoPage() {
  const { t } = useFeatureTranslation("page.settings");
  return (
    <SettingPageLayout title={t("sso.title")}>
      <EmptyComingSoon
        icon={<Globe2 />}
        title={t("sso.placeholder.title")}
        description={t("sso.placeholder.description")}
      />
    </SettingPageLayout>
  );
}
