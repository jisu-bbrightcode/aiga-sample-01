/**
 * OrgBillingEmailSection — invoice / billing notification address (Phase 2.5).
 */
import { useFeatureTranslation } from "@repo/core/i18n";
import { SettingItem } from "@repo/ui/settings";
import { Input } from "@repo/ui/shadcn/input";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { $api, apiClient, getOrganizationMetadataQueryKey, requireApiData } from "../../../api";

interface Props {
  organizationId: string;
}

export function OrgBillingEmailSection({ organizationId }: Props) {
  const qc = useQueryClient();
  const meta = $api.useQuery("get", "/api/organization-settings/{organizationId}/metadata", {
    params: { path: { organizationId } },
  });
  const update = useMutation({
    mutationKey: ["patch", "/api/organization-settings/{organizationId}/billing-email"],
    mutationFn: async (input: { organizationId: string; billingEmail: string | null }) => {
      const { data, error } = await apiClient.PATCH(
        "/api/organization-settings/{organizationId}/billing-email",
        {
          params: { path: { organizationId: input.organizationId } },
          body: { billingEmail: input.billingEmail },
        },
      );
      if (error) throw error;
      return requireApiData(data);
    },
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: getOrganizationMetadataQueryKey(organizationId),
      }),
  });
  const [value, setValue] = useState("");
  const { t } = useFeatureTranslation("page.settings");

  useEffect(() => {
    setValue(meta.data?.billingEmail ?? "");
  }, [meta.data?.billingEmail]);

  function onBlur() {
    const trimmed = value.trim();
    if (trimmed === (meta.data?.billingEmail ?? "")) return;
    update.mutate({
      organizationId,
      billingEmail: trimmed === "" ? null : trimmed,
    });
  }

  return (
    <SettingItem
      title={t("organization.billingEmail.title")}
      description={t("organization.billingEmail.description")}
    >
      <Input
        type="email"
        value={value}
        placeholder="billing@example.com"
        onChange={(e) => setValue(e.target.value)}
        onBlur={onBlur}
      />
    </SettingItem>
  );
}
