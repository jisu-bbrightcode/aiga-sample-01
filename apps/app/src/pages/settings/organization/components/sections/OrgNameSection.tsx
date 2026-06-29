/**
 * OrgNameSection — change displayed organization name (Phase 2.4).
 */
import { authClient } from "@repo/core/auth/client";
import { useFeatureTranslation } from "@repo/core/i18n";
import { SettingItem } from "@repo/ui/settings";
import { Input } from "@repo/ui/shadcn/input";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { apiClient, requireApiData } from "../../../api";

interface Props {
  organizationId: string;
}

export function OrgNameSection({ organizationId }: Props) {
  const { data: org } = authClient.useActiveOrganization();
  const update = useMutation({
    mutationKey: ["patch", "/api/organization-settings/{organizationId}"],
    mutationFn: async (input: { organizationId: string; name?: string; slug?: string }) => {
      const { data, error } = await apiClient.PATCH("/api/organization-settings/{organizationId}", {
        params: { path: { organizationId: input.organizationId } },
        body: { name: input.name, slug: input.slug },
      });
      if (error) throw error;
      return requireApiData(data);
    },
  });
  const [value, setValue] = useState("");
  const { t } = useFeatureTranslation("page.settings");

  useEffect(() => {
    if (org?.name) setValue(org.name);
  }, [org?.name]);

  function onBlur() {
    if (!org || value === org.name) return;
    if (!value.trim()) {
      setValue(org.name ?? "");
      return;
    }
    update.mutate({ organizationId, name: value.trim() });
  }

  return (
    <SettingItem
      title={t("organization.name.title")}
      description={t("organization.name.description")}
    >
      <Input value={value} onChange={(e) => setValue(e.target.value)} onBlur={onBlur} />
    </SettingItem>
  );
}
