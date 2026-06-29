/**
 * App Layout - 인증된 일반 유저용 레이아웃
 *
 * layoutConfig.appShellVariant 로 Application Shell 스타일 변경 가능
 */

import { authenticatedAtom } from "@repo/core/auth";
import { useAtomValue } from "jotai";
import type React from "react";
import { AppWorkspaceLoadingState } from "@/components/app-loading";
import { useRequireActiveWorkspace } from "@/pages/auth/use-require-active-workspace";
import { AppShell01 } from "./blocks/app-shell-01";
import { AppShell02 } from "./blocks/app-shell-02";
import { AppShell07 } from "./blocks/app-shell-07";
import { AppShellAgent } from "./blocks/app-shell-agent";
import { type AppShellVariant, layoutConfig } from "./config";

const variantMap: Record<AppShellVariant, React.ComponentType> = {
  1: AppShell01,
  2: AppShell02,
  7: AppShell07,
  agent: AppShellAgent,
};

export function AppLayout() {
  const authenticated = useAtomValue(authenticatedAtom);
  const { isCheckingWorkspace, needsWorkspace } = useRequireActiveWorkspace(authenticated === true);
  const Component = variantMap[layoutConfig.appShellVariant] ?? AppShell01;

  if (isCheckingWorkspace || needsWorkspace) {
    return <AppWorkspaceLoadingState />;
  }

  return <Component />;
}
