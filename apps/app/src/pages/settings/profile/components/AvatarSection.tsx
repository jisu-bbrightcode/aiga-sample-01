import { useFeatureTranslation } from "@repo/core/i18n";
import { HueAvatar, SettingItem } from "@repo/ui/settings";
import { Button } from "@repo/ui/shadcn/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { $api, apiClient, requireApiData, USER_PROFILE_ME_QUERY_KEY } from "../../api";

export function AvatarSection() {
  const qc = useQueryClient();
  const me = $api.useQuery("get", "/api/user-profile/me", {});
  const sign = useMutation({
    mutationKey: ["post", "/api/user-profile/avatar/upload-url"],
    mutationFn: async (input: { contentType: string; fileName: string }) => {
      const { data, error } = await apiClient.POST("/api/user-profile/avatar/upload-url", {
        body: input,
      });
      if (error) throw error;
      return requireApiData(data);
    },
  });
  const confirm = useMutation({
    mutationKey: ["post", "/api/user-profile/avatar/confirm"],
    mutationFn: async (input: { publicUrl: string }) => {
      const { data, error } = await apiClient.POST("/api/user-profile/avatar/confirm", {
        body: input,
      });
      if (error) throw error;
      return requireApiData(data);
    },
  });
  const fileInput = useRef<HTMLInputElement>(null);
  const pending = sign.isPending || confirm.isPending;
  const { t } = useFeatureTranslation("page.settings");

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInput.current) fileInput.current.value = "";
    try {
      const { uploadUrl, publicUrl } = await sign.mutateAsync({
        contentType: file.type,
        fileName: file.name,
      });
      const res = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!res.ok) throw new Error(`Avatar upload failed: ${res.status}`);
      await confirm.mutateAsync({ publicUrl });
      await qc.invalidateQueries({ queryKey: USER_PROFILE_ME_QUERY_KEY });
    } catch (err) {
      console.error("Avatar upload failed", err);
    }
  }

  return (
    <SettingItem title={t("profile.avatar.title")} description={t("profile.avatar.description")}>
      <div className="flex items-center gap-6">
        <HueAvatar
          name={me.data?.name ?? undefined}
          email={me.data?.email ?? undefined}
          src={me.data?.avatar ?? undefined}
          size="lg"
        />
        <div className="flex items-center gap-2">
          <Button type="button" onClick={() => fileInput.current?.click()} disabled={pending}>
            {pending ? t("profile.avatar.uploading") : t("profile.avatar.upload")}
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={onChange}
          />
          <Button type="button" variant="outline" disabled>
            {t("profile.avatar.remove")}
          </Button>
        </div>
      </div>
    </SettingItem>
  );
}
