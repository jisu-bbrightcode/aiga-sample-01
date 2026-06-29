/**
 * Workspace layout page: AppShell with 200px sidebar + Outlet.
 * Route: /p/$projectId
 */
import { AuthGuard, authenticatedAtom } from "@repo/core/auth";
import { useFeatureTranslation } from "@repo/core/i18n";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import { lazy, Suspense, useEffect } from "react";
import { AppAuthLoadingState, AppWorkspaceLoadingState } from "@/components/app-loading";
import { useRequireActiveWorkspace } from "@/pages/auth/use-require-active-workspace";
import { loadAppShell, preloadStoryRouteModules } from "../routes/story-route-modules";

const AppShell = lazy(() => loadAppShell().then((m) => ({ default: m.AppShell })));

export function WorkspacePage() {
  const { t } = useFeatureTranslation("feature.story");
  const navigate = useNavigate();
  const authenticated = useAtomValue(authenticatedAtom);
  const { isCheckingWorkspace, needsWorkspace } = useRequireActiveWorkspace(authenticated === true);
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    if (authenticated === false) return;
    void preloadStoryRouteModules(pathname).catch(() => undefined);
  }, [authenticated, pathname]);

  const loading = <AppWorkspaceLoadingState label={null} loaderLabel={t("workspace.loading.project")} />;

  return (
    <AuthGuard
      authenticated={authenticated}
      loadingFallback={<AppAuthLoadingState label={null} loaderLabel={t("workspace.loading.session")} />}
      onUnauthenticated={() => {
        navigate({ to: "/sign-in" });
      }}
    >
      {isCheckingWorkspace || needsWorkspace ? (
        loading
      ) : (
        <Suspense fallback={loading}>
          <AppShell />
        </Suspense>
      )}
    </AuthGuard>
  );
}
