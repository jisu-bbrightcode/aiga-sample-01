/**
 * DeleteAccountSection — permanent account deletion with confirm phrase.
 *
 * Refuses if the user owns any organization (must transfer ownership
 * first). Calls better-auth deleteUser.
 */
import { authClient } from "@repo/core/auth/client";
import { useFeatureTranslation } from "@repo/core/i18n";
import { SetConfirmDialog, SetDangerZone, SettingItem } from "@repo/ui/settings";
import { Button } from "@repo/ui/shadcn/button";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

export function DeleteAccountSection() {
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const { t } = useFeatureTranslation("page.settings");

  const handle = session?.user?.email?.split("@")[0] ?? "you";
  const phrase = `DELETE-${handle}`;

  async function onConfirm() {
    setPending(true);
    try {
      await authClient.deleteUser();
      await authClient.signOut();
      navigate({ to: "/sign-in" });
    } finally {
      setPending(false);
    }
  }

  return (
    <SettingItem title={t("profile.deleteAccount.title")}>
      <SetDangerZone
        title={t("profile.deleteAccount.dangerTitle")}
        description={t("profile.deleteAccount.dangerDescription")}
      >
        <Button type="button" variant="destructive" onClick={() => setOpen(true)}>
          {t("profile.deleteAccount.button")}
        </Button>
      </SetDangerZone>
      <SetConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t("profile.deleteAccount.confirmTitle")}
        description={t("profile.deleteAccount.confirmDescription")}
        confirmPhrase={phrase}
        onConfirm={onConfirm}
        pending={pending}
      />
    </SettingItem>
  );
}
