/**
 * Replays a pending personalization action after login (FR-002 / BBR-729).
 *
 * Mounted on the service-flow pages. When the session resolves to authenticated
 * and a {@link readPendingIntent pending intent} exists — i.e. the user clicked
 * 저장/관심 while logged out and was routed through sign-in — this fires that exact
 * write once and acknowledges it, completing 원래 액션 자동 복귀. The intent is
 * cleared up-front and a ref guards against a second run, so the action is
 * replayed exactly once even under re-render / StrictMode double-invoke.
 */

import { authenticatedAtom } from "@repo/core/auth";
import { useFeatureTranslation } from "@repo/core/i18n";
import { useAtomValue } from "jotai";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { getAppErrorMessage } from "@/lib/user-facing-error";
import { clearPendingIntent, readPendingIntent } from "../lib/pending-intent";
import { useCreateInterest, useCreateSavedItem } from "./mutations";

export function usePendingIntentReplay(): void {
  const { t } = useFeatureTranslation("app");
  const authenticated = useAtomValue(authenticatedAtom);
  const saveMutation = useCreateSavedItem();
  const interestMutation = useCreateInterest();
  const replayedRef = useRef(false);

  useEffect(() => {
    if (authenticated !== true || replayedRef.current) return;
    const intent = readPendingIntent();
    if (!intent) return;

    // Single-use: clear + latch before firing so a re-render cannot replay it.
    replayedRef.current = true;
    clearPendingIntent();

    const { kind, targetType, targetId } = intent;
    const handlers = {
      onSuccess: () =>
        toast.success(
          kind === "save" ? t("serviceFlow.actions.saved") : t("serviceFlow.actions.interested"),
        ),
      onError: (error: unknown) => toast.error(getAppErrorMessage(t, error)),
    };

    if (kind === "save") {
      saveMutation.mutate({ targetType, targetId }, handlers);
    } else {
      interestMutation.mutate({ targetType, targetId }, handlers);
    }
  }, [authenticated, saveMutation, interestMutation, t]);
}
