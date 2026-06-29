import { useFeatureTranslation } from "@repo/core/i18n";
import { SetConfirmDialog, SetDangerZone, SettingItem } from "@repo/ui/settings";
import { Button } from "@repo/ui/shadcn/button";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { usePermanentlyDeleteProject } from "@/features/project/hooks/use-project-mutations";

interface Props {
  projectId: string;
  name: string;
}

export function ProjectDeleteSection({ projectId, name }: Props) {
  const navigate = useNavigate();
  const del = usePermanentlyDeleteProject();
  const [open, setOpen] = useState(false);
  const { t } = useFeatureTranslation("page.settings");

  async function onConfirm() {
    await del.mutateAsync(projectId);
    setOpen(false);
    navigate({ to: "/settings" });
  }

  return (
    <SettingItem title={t("projects.detail.delete.title")}>
      <SetDangerZone
        title={t("projects.detail.delete.dangerTitle", { name })}
        description={t("projects.detail.delete.dangerDescription")}
      >
        <Button type="button" variant="destructive" onClick={() => setOpen(true)}>
          {t("projects.detail.delete.button")}
        </Button>
      </SetDangerZone>
      <SetConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t("projects.detail.delete.confirmTitle")}
        description={t("projects.detail.delete.confirmDescription", { name })}
        confirmPhrase={`DELETE-${name}`}
        onConfirm={onConfirm}
        pending={del.isPending}
      />
    </SettingItem>
  );
}
