import { useFeatureTranslation } from "@repo/core/i18n";
import { EmptyComingSoon } from "@repo/ui/settings";
import { Ticket } from "lucide-react";
import { SettingPageLayout } from "../_shared/SettingPageLayout";

export function CouponsPage() {
  const { t } = useFeatureTranslation("page.settings");
  return (
    <SettingPageLayout title={t("coupons.title")}>
      <EmptyComingSoon
        icon={<Ticket />}
        title={t("coupons.placeholder.title")}
        description={t("coupons.placeholder.description")}
      />
    </SettingPageLayout>
  );
}
