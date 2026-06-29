import { useFeatureTranslation } from "@repo/core/i18n";
import { SettingItem } from "@repo/ui/settings";
import { Input } from "@repo/ui/shadcn/input";
import { $api } from "../../api";

export function EmailField() {
  const me = $api.useQuery("get", "/api/user-profile/me", {});
  const { t } = useFeatureTranslation("page.settings");

  return (
    <SettingItem title={t("profile.email.title")} description={t("profile.email.description")}>
      <Input value={me.data?.email ?? ""} type="email" readOnly disabled />
    </SettingItem>
  );
}
