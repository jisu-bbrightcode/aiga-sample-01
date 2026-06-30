/**
 * Auth-only gate for the service flow's private routes (PB-WEB-002 / BBR-580).
 *
 * Unlike the workspace shells (AppLayout / DashboardLayout) this does NOT
 * require an active organization — the AIGA service is consumer-facing, so a
 * logged-in user reaches their My Page without picking a workspace. While the
 * session hydrates we show a loading state (AC#1: 로딩 상태); when unauthenticated
 * we route to sign-in carrying the current path as `next`, so the user returns
 * here after logging in (AC#2: 원래 의도로 복귀).
 */

import { AuthGuard, authenticatedAtom } from "@repo/core/auth";
import { useFeatureTranslation } from "@repo/core/i18n";
import { useNavigate } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import type { ReactNode } from "react";
import { AppAuthLoadingState } from "@/components/app-loading";
import { getCurrentAuthPath } from "@/lib/auth-next-path";
import { buildSignInIntentPath } from "../lib/gated-intent";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { t } = useFeatureTranslation("app");
  const authenticated = useAtomValue(authenticatedAtom);
  const navigate = useNavigate();

  return (
    <AuthGuard
      authenticated={authenticated}
      onUnauthenticated={() => {
        navigate({ to: buildSignInIntentPath(getCurrentAuthPath()) as never });
      }}
      loadingFallback={
        <AppAuthLoadingState loaderLabel={t("serviceFlow.states.checkingSession")} />
      }
    >
      {children}
    </AuthGuard>
  );
}
