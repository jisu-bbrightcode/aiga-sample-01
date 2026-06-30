/**
 * Gated personalization action button — 저장/관심 추가 (FR-002 / BBR-729).
 *
 * 공개 탐색은 비로그인 허용, 개인화 액션에서만 로그인 게이트:
 *  - Logged out → persist the attempted action ({@link storePendingIntent}) and
 *    route to sign-in carrying the current page as `next`. After login the page
 *    replays the action, so the click survives the redirect (원래 액션 자동 복귀).
 *  - Logged in → fire the write immediately and acknowledge with a toast. The
 *    write is idempotent server-side, so a double-click is harmless.
 *
 * Errors are surfaced through `getAppErrorMessage` (stable code → friendly copy),
 * never as raw server text.
 */

import { authenticatedAtom } from "@repo/core/auth";
import { useFeatureTranslation } from "@repo/core/i18n";
import { Button } from "@repo/ui/shadcn/button";
import { useNavigate } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import { Bookmark, Heart } from "lucide-react";
import { toast } from "sonner";
import { getCurrentAuthPath } from "@/lib/auth-next-path";
import { getAppErrorMessage } from "@/lib/user-facing-error";
import type { ServiceTargetType } from "../api/types";
import { useCreateInterest, useCreateSavedItem } from "../hooks/mutations";
import { buildSignInIntentPath } from "../lib/gated-intent";
import { type PendingIntentKind, storePendingIntent } from "../lib/pending-intent";

interface GatedActionButtonProps {
  kind: PendingIntentKind;
  targetType: ServiceTargetType;
  targetId: string;
  label: string;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm";
}

export function GatedActionButton({
  kind,
  targetType,
  targetId,
  label,
  variant = "outline",
  size = "sm",
}: GatedActionButtonProps) {
  const { t } = useFeatureTranslation("app");
  const authenticated = useAtomValue(authenticatedAtom);
  const navigate = useNavigate();
  const saveMutation = useCreateSavedItem();
  const interestMutation = useCreateInterest();

  const Icon = kind === "save" ? Bookmark : Heart;
  const isPending = kind === "save" ? saveMutation.isPending : interestMutation.isPending;
  const successMessage =
    kind === "save" ? t("serviceFlow.actions.saved") : t("serviceFlow.actions.interested");

  const onClick = () => {
    if (authenticated !== true) {
      // Remember the attempted action, then gate through sign-in (return-to-intent).
      storePendingIntent({ kind, targetType, targetId });
      navigate({ to: buildSignInIntentPath(getCurrentAuthPath()) as never });
      return;
    }
    if (isPending) return;
    const handlers = {
      onSuccess: () => toast.success(successMessage),
      onError: (error: unknown) => toast.error(getAppErrorMessage(t, error)),
    };
    if (kind === "save") {
      saveMutation.mutate({ targetType, targetId }, handlers);
    } else {
      interestMutation.mutate({ targetType, targetId }, handlers);
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={onClick}
      disabled={isPending}
      className="gap-1.5"
      data-el={`service-flow.gated-action.${kind}`}
    >
      <Icon className="size-3.5" />
      {label}
    </Button>
  );
}
