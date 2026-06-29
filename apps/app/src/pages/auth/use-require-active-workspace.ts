import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getSessionActiveWorkspaceId } from "@/features/workspace/active-workspace";
import { getCurrentAuthPath } from "../../lib/auth-next-path";
import { authClient } from "../../lib/auth-client";

export function useRequireActiveWorkspace(enabled: boolean) {
  const navigate = useNavigate();
  const [activatingWorkspaceId, setActivatingWorkspaceId] = useState<string | null>(null);
  const [activationFailedWorkspaceId, setActivationFailedWorkspaceId] = useState<string | null>(null);
  const [optimisticActiveWorkspaceId, setOptimisticActiveWorkspaceId] = useState<string | null>(
    null,
  );
  const { data: session, isPending: sessionPending, refetch: refetchSession } =
    authClient.useSession();
  const {
    data: organizations,
    isPending: organizationsPending,
    refetch: refetchOrganizations,
  } = workspaceAuthClient.useListOrganizations();
  const sessionActiveWorkspaceId = getActiveOrganizationId(session);
  const activeWorkspaceId = getActiveWorkspaceId(
    organizations,
    sessionActiveWorkspaceId ?? optimisticActiveWorkspaceId,
  );
  const { activationRequired: autoActivationRequired, singleWorkspaceId } = getAutoActivationState({
    activeWorkspaceId,
    activationFailedWorkspaceId,
    enabled,
    organizations,
    session,
    sessionActiveWorkspaceId,
  });
  const activationInProgress =
    activatingWorkspaceId !== null && activatingWorkspaceId === singleWorkspaceId;
  const workspacePending = getWorkspacePendingState({
    activationInProgress,
    autoActivationRequired,
    enabled,
    organizationsPending,
    session,
    sessionPending,
  });
  const workspaceRequired =
    enabled && !workspacePending && Boolean(session?.user) && !activeWorkspaceId && !autoActivationRequired;

  useEffect(() => {
    if (sessionActiveWorkspaceId !== null) {
      setOptimisticActiveWorkspaceId(null);
    }
    if (activationFailedWorkspaceId && activationFailedWorkspaceId !== singleWorkspaceId) {
      setActivationFailedWorkspaceId(null);
    }
  }, [activationFailedWorkspaceId, sessionActiveWorkspaceId, singleWorkspaceId]);

  useEffect(() => {
    if (!enabled || !autoActivationRequired || !singleWorkspaceId || activationInProgress) {
      return;
    }
    setActivatingWorkspaceId(singleWorkspaceId);
    workspaceAuthClient.organization
      .setActive({ organizationId: singleWorkspaceId })
      .then(async (result) => {
        if (result.error) {
          setActivationFailedWorkspaceId(singleWorkspaceId);
          return;
        }
        setOptimisticActiveWorkspaceId(singleWorkspaceId);
        await Promise.all([refetchSession?.(), refetchOrganizations?.()]);
      })
      .then(
        () => {
          setActivatingWorkspaceId((current) =>
            current === singleWorkspaceId ? null : current,
          );
        },
        () => {
          setActivationFailedWorkspaceId(singleWorkspaceId);
          setActivatingWorkspaceId((current) =>
            current === singleWorkspaceId ? null : current,
          );
        },
      );
  }, [
    autoActivationRequired,
    enabled,
    activationInProgress,
    refetchOrganizations,
    refetchSession,
    singleWorkspaceId,
  ]);

  useEffect(() => {
    if (!workspaceRequired) return;
    const nextPath = getCurrentAuthPath();
    if (nextPath === "/") {
      navigate({ to: "/workspace-select" }).catch(() => undefined);
      return;
    }
    navigate({ to: "/workspace-select", search: { next: nextPath } }).catch(() => undefined);
  }, [navigate, workspaceRequired]);

  return {
    activeWorkspaceId,
    isCheckingWorkspace: enabled && workspacePending,
    needsWorkspace: workspaceRequired,
  };
}

/* -------------------------------------------------------------------------------------------------
 * Constants
 * -----------------------------------------------------------------------------------------------*/

const workspaceAuthClient = authClient as unknown as WorkspaceAuthClient;

/* -------------------------------------------------------------------------------------------------
 * Helper Functions
 * -----------------------------------------------------------------------------------------------*/

function getActiveOrganizationId(session: unknown): string | null {
  return getSessionActiveWorkspaceId(session);
}

function getActiveWorkspaceId(
  organizations: WorkspaceOrganization[] | null | undefined,
  workspaceId: string | null,
) {
  return organizations?.some((organization) => organization.id === workspaceId) ? workspaceId : null;
}

function getSingleWorkspaceId(organizations: WorkspaceOrganization[] | null | undefined) {
  return organizations?.length === 1 ? organizations[0]?.id : null;
}

function getAutoActivationState(input: AutoActivationStateInput) {
  const singleWorkspaceId = getSingleWorkspaceId(input.organizations);
  const currentPathAllowsActivation = getCurrentAuthPath().startsWith("/p/");
  const userPresent = Boolean(input.session?.user);
  const activationRequired =
    input.enabled &&
    currentPathAllowsActivation &&
    userPresent &&
    input.sessionActiveWorkspaceId === null &&
    !input.activeWorkspaceId &&
    Boolean(singleWorkspaceId) &&
    input.activationFailedWorkspaceId !== singleWorkspaceId;

  return { activationRequired, singleWorkspaceId };
}

function getWorkspacePendingState(input: PendingStateInput) {
  return (
    input.sessionPending ||
    (Boolean(input.session?.user) && input.organizationsPending) ||
    (input.enabled && (input.autoActivationRequired || input.activationInProgress))
  );
}

/* -------------------------------------------------------------------------------------------------
 * Types
 * -----------------------------------------------------------------------------------------------*/

interface WorkspaceOrganization {
  id: string;
}

interface WorkspaceQueryResult {
  data?: WorkspaceOrganization[] | null;
  isPending: boolean;
  refetch?: () => Promise<unknown>;
}

interface AuthMutationResult<T> {
  data?: T | null;
  error?: { message?: string; code?: string } | null;
}

type WorkspaceAuthClient = typeof authClient & {
  useListOrganizations: () => WorkspaceQueryResult;
  organization: {
    setActive: (input: { organizationId: string }) => Promise<AuthMutationResult<unknown>>;
  };
};

interface AutoActivationStateInput {
  activeWorkspaceId: string | null;
  activationFailedWorkspaceId: string | null;
  enabled: boolean;
  organizations: WorkspaceOrganization[] | null | undefined;
  session: { user?: unknown } | null | undefined;
  sessionActiveWorkspaceId: string | null;
}

interface PendingStateInput {
  activationInProgress: boolean;
  autoActivationRequired: boolean;
  enabled: boolean;
  organizationsPending: boolean;
  session: { user?: unknown } | null | undefined;
  sessionPending: boolean;
}
