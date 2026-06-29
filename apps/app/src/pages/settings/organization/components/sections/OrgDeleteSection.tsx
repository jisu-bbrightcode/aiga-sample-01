/**
 * OrgDeleteSection — soft-delete the organization (Phase 2.6).
 *
 * Soft-delete via metadata.deletedAt (organizationSettings.deleteOrganization).
 * Hard-delete is reserved for an admin tool. Confirm phrase = `DELETE-{slug}`.
 */
import { authClient } from "@repo/core/auth/client";
import { useFeatureTranslation } from "@repo/core/i18n";
import { SetConfirmDialog, SetDangerZone, SettingItem } from "@repo/ui/settings";
import { Button } from "@repo/ui/shadcn/button";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { $api, apiClient, requireApiData } from "../../../api";

interface Props {
  organizationId: string;
}

export function OrgDeleteSection({ organizationId }: Props) {
  const navigate = useNavigate();
  const { data: org } = authClient.useActiveOrganization();
  const membership = $api.useQuery(
    "get",
    "/api/organization-settings/{organizationId}/membership",
    {
      params: { path: { organizationId } },
    },
  );
  const del = useMutation({
    mutationKey: ["delete", "/api/organization-settings/{organizationId}"],
    mutationFn: async (input: { organizationId: string }) => {
      const { data, error } = await apiClient.DELETE(
        "/api/organization-settings/{organizationId}",
        {
          params: { path: { organizationId: input.organizationId } },
        },
      );
      if (error) throw error;
      return requireApiData(data);
    },
  });
  const [open, setOpen] = useState(false);
  const { t } = useFeatureTranslation("page.settings");

  if (membership.isLoading) return null;
  if (membership.data?.role !== "owner") return null;

  const slug = org?.slug ?? "organization";
  const phrase = `DELETE-${slug}`;
  const dangerName = org?.name ?? t("organization.delete.fallbackName");
  const confirmName = org?.name ?? t("organization.delete.fallbackNameShort");

  async function onConfirm() {
    await del.mutateAsync({ organizationId });
    navigate({ to: "/" });
  }

  return (
    <SettingItem title={t("organization.delete.title")}>
      <SetDangerZone
        title={t("organization.delete.dangerTitle", { name: dangerName })}
        description={t("organization.delete.dangerDescription")}
      >
        <Button type="button" variant="destructive" onClick={() => setOpen(true)}>
          {t("organization.delete.button")}
        </Button>
      </SetDangerZone>
      <SetConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t("organization.delete.confirmTitle")}
        description={t("organization.delete.confirmDescription", { name: confirmName })}
        confirmPhrase={phrase}
        onConfirm={onConfirm}
        pending={del.isPending}
      />
    </SettingItem>
  );
}
