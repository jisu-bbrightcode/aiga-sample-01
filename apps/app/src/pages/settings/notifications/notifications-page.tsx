import { useFeatureTranslation } from "@repo/core/i18n";
import { EmptyComingSoon } from "@repo/ui/settings";
import { Bell } from "lucide-react";
import { SettingPageLayout } from "../_shared/SettingPageLayout";

export function NotificationsPage() {
  const { t } = useFeatureTranslation("page.settings");
  return (
    <SettingPageLayout title={t("notifications.title")}>
      <EmptyComingSoon
        icon={<Bell />}
        title={t("notifications.placeholder.title")}
        description={t("notifications.placeholder.description")}
      />
    </SettingPageLayout>
  );
}
