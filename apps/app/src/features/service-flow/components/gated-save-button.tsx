/**
 * Gated protected-action button (PB-WEB-002 / BBR-580, AC#2).
 *
 * Logged out → route to sign-in with the current location as `next`, so after
 * login the user is returned to exactly where they acted (return-to-intent).
 * Logged in → take them to their My Page, where saved activity lives. The save
 * WRITE API is a separate feature (BBR-726, not yet on main); until it lands the
 * authenticated path navigates to 내 페이지 rather than faking a mutation, with a
 * short toast so the action still acknowledges.
 */

import { authenticatedAtom } from "@repo/core/auth";
import { useFeatureTranslation } from "@repo/core/i18n";
import { Button } from "@repo/ui/shadcn/button";
import { useNavigate } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import { Bookmark } from "lucide-react";
import { toast } from "sonner";
import { getCurrentAuthPath } from "@/lib/auth-next-path";
import { buildSignInIntentPath } from "../lib/gated-intent";

interface GatedSaveButtonProps {
  label: string;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm";
  /** Toast shown to an authenticated user after routing to My Page. */
  authedNotice?: string;
}

export function GatedSaveButton({
  label,
  variant = "outline",
  size = "sm",
  authedNotice,
}: GatedSaveButtonProps) {
  const { t } = useFeatureTranslation("app");
  const authenticated = useAtomValue(authenticatedAtom);
  const navigate = useNavigate();

  const onClick = () => {
    if (authenticated !== true) {
      navigate({ to: buildSignInIntentPath(getCurrentAuthPath()) as never });
      return;
    }
    toast.info(authedNotice ?? t("serviceFlow.save.managedOnMyPage"));
    navigate({ to: "/me" });
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={onClick}
      className="gap-1.5"
      data-el="service-flow.gated-save"
    >
      <Bookmark className="size-3.5" />
      {label}
    </Button>
  );
}
