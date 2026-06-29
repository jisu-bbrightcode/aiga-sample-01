/**
 * SettingsLayout — viewport-spanning shell.
 * Header full width · sidebar pinned to viewport left edge ·
 * main with centered content cap.
 */

import { AuthGuard, authenticatedAtom } from "@repo/core/auth";
import { useFeatureTranslation } from "@repo/core/i18n";
import { Button } from "@repo/ui/shadcn/button";
import { Outlet, useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import { ArrowLeft } from "lucide-react";
import { AppAuthLoadingState, AppWorkspaceLoadingState } from "@/components/app-loading";
import { useRequireActiveWorkspace } from "../auth/use-require-active-workspace";
import { $api } from "./api";
import { SettingsSidebar } from "./SettingsSidebar";

export function SettingsLayout() {
  const router = useRouter();
  const navigate = useNavigate();
  const authenticated = useAtomValue(authenticatedAtom);
  const { isCheckingWorkspace, needsWorkspace } = useRequireActiveWorkspace(authenticated === true);
  const { t } = useFeatureTranslation("page.settings");
  const search = useSearch({ strict: false }) as { projectId?: string };
  const projectId = search.projectId;
  const projectDetail = $api.useQuery(
    "get",
    "/api/settings-projects/{projectId}",
    {
      params: { path: { projectId: projectId ?? "" } },
    },
    { enabled: Boolean(projectId) },
  );

  const handleBack = () => {
    if (window.history.length > 1) {
      router.history.back();
    } else {
      navigate({ to: "/" });
    }
  };

  return (
    <AuthGuard
      authenticated={authenticated}
      onUnauthenticated={() => {
        navigate({ to: "/sign-in" });
      }}
      loadingFallback={<AppAuthLoadingState />}
    >
      {isCheckingWorkspace || needsWorkspace ? (
        <AppWorkspaceLoadingState />
      ) : (
        <div className="flex h-screen flex-col">
          <header className="flex h-11 items-center gap-4 px-6">
            <Button variant="ghost" size="sm" onClick={handleBack} className="h-8 gap-1.5 px-2">
              <ArrowLeft className="size-3.5" />
              <span className="text-xs font-medium">{t("layout.back")}</span>
            </Button>
            <h1 className="text-base font-semibold tracking-tight">{t("layout.title")}</h1>
          </header>
          <div className="flex flex-1 overflow-hidden">
            <SettingsSidebar projectId={projectId} currentProjectName={projectDetail.data?.name} />
            <main className="flex-1 overflow-y-auto px-8 py-8">
              <Outlet />
            </main>
          </div>
        </div>
      )}
    </AuthGuard>
  );
}
