/**
 * OrgLogoSection — brand logo upload (Phase 2.3).
 */
import { authClient } from "@repo/core/auth/client";
import { useFeatureTranslation } from "@repo/core/i18n";
import { HueAvatar, SettingItem } from "@repo/ui/settings";
import { Button } from "@repo/ui/shadcn/button";
import { useMutation } from "@tanstack/react-query";
import { useRef } from "react";
import { apiClient, requireApiData } from "../../../api";

interface Props {
  organizationId: string;
}

export function OrgLogoSection({ organizationId }: Props) {
  const { data: org } = authClient.useActiveOrganization();
  const sign = useMutation({
    mutationKey: ["post", "/api/organization-settings/{organizationId}/logo/upload-url"],
    mutationFn: async (input: {
      organizationId: string;
      contentType: string;
      fileName: string;
    }) => {
      const { data, error } = await apiClient.POST(
        "/api/organization-settings/{organizationId}/logo/upload-url",
        {
          params: { path: { organizationId: input.organizationId } },
          body: { contentType: input.contentType, fileName: input.fileName },
        },
      );
      if (error) throw error;
      return requireApiData(data);
    },
  });
  const confirm = useMutation({
    mutationKey: ["post", "/api/organization-settings/{organizationId}/logo/confirm"],
    mutationFn: async (input: { organizationId: string; publicUrl: string }) => {
      const { data, error } = await apiClient.POST(
        "/api/organization-settings/{organizationId}/logo/confirm",
        {
          params: { path: { organizationId: input.organizationId } },
          body: { publicUrl: input.publicUrl },
        },
      );
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
        organizationId,
        contentType: file.type,
        fileName: file.name,
      });
      const res = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!res.ok) {
        throw new Error(`Logo upload failed: ${res.status}`);
      }
      await confirm.mutateAsync({ organizationId, publicUrl });
    } catch (err) {
      console.error("Logo upload failed", err);
    }
  }

  return (
    <SettingItem
      title={t("organization.logo.title")}
      description={t("organization.logo.description")}
      footer={t("organization.logo.hint")}
    >
      <div className="flex items-center gap-6">
        <HueAvatar name={org?.name} src={org?.logo ?? undefined} size="lg" />
        <div className="flex items-center gap-2">
          <Button type="button" onClick={() => fileInput.current?.click()} disabled={pending}>
            {pending ? t("organization.logo.uploading") : t("organization.logo.upload")}
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/svg+xml,image/jpeg"
            className="hidden"
            onChange={onChange}
          />
          <Button type="button" variant="outline" disabled>
            {t("organization.logo.remove")}
          </Button>
        </div>
      </div>
    </SettingItem>
  );
}
