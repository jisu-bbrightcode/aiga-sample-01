import { useFeatureTranslation } from "@repo/core/i18n";
import { SettingItem } from "@repo/ui/settings";
import { Input } from "@repo/ui/shadcn/input";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { $api, apiClient, requireApiData, USER_PROFILE_ME_QUERY_KEY } from "../../api";

export function NameField() {
  const qc = useQueryClient();
  const me = $api.useQuery("get", "/api/user-profile/me", {});
  const updateName = useMutation({
    mutationKey: ["patch", "/api/user-profile/name"],
    mutationFn: async (input: { name: string }) => {
      const { data, error } = await apiClient.PATCH("/api/user-profile/name", { body: input });
      if (error) throw error;
      return requireApiData(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: USER_PROFILE_ME_QUERY_KEY }),
  });
  const [value, setValue] = useState("");
  const { t } = useFeatureTranslation("page.settings");

  useEffect(() => {
    if (me.data?.name) setValue(me.data.name);
  }, [me.data?.name]);

  function onBlur() {
    if (value.trim() && value !== me.data?.name) {
      updateName.mutate({ name: value.trim() });
    }
  }

  return (
    <SettingItem title={t("profile.name.title")} description={t("profile.name.description")}>
      <Input value={value} onChange={(e) => setValue(e.target.value)} onBlur={onBlur} />
    </SettingItem>
  );
}
