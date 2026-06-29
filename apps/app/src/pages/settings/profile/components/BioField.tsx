import { useFeatureTranslation } from "@repo/core/i18n";
import { SettingItem } from "@repo/ui/settings";
import { Textarea } from "@repo/ui/shadcn/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { $api, apiClient, requireApiData, USER_PROFILE_ME_QUERY_KEY } from "../../api";

export function BioField() {
  const qc = useQueryClient();
  const me = $api.useQuery("get", "/api/user-profile/me", {});
  const update = useMutation({
    mutationKey: ["patch", "/api/user-profile/bio"],
    mutationFn: async (input: { bio: string }) => {
      const { data, error } = await apiClient.PATCH("/api/user-profile/bio", { body: input });
      if (error) throw error;
      return requireApiData(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: USER_PROFILE_ME_QUERY_KEY }),
  });
  const [value, setValue] = useState("");
  const { t } = useFeatureTranslation("page.settings");

  useEffect(() => {
    setValue(me.data?.bio ?? "");
  }, [me.data?.bio]);

  function onBlur() {
    if (value !== (me.data?.bio ?? "")) {
      update.mutate({ bio: value });
    }
  }

  return (
    <SettingItem title={t("profile.bio.title")} description={t("profile.bio.description")}>
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={onBlur}
        rows={3}
        maxLength={500}
        placeholder={t("profile.bio.placeholder")}
      />
    </SettingItem>
  );
}
