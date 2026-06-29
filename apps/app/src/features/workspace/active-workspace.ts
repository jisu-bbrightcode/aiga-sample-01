import { atom } from "jotai";

export interface ActiveWorkspaceOverride {
  organizationId: string;
  isSwitching: boolean;
}

export const activeWorkspaceOverrideAtom = atom<ActiveWorkspaceOverride | null>(null);

export function getSessionActiveWorkspaceId(session: unknown): string | null {
  const value = (session as { session?: { activeOrganizationId?: unknown } } | null)?.session
    ?.activeOrganizationId;
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function getEffectiveActiveWorkspaceId(
  session: unknown,
  override: ActiveWorkspaceOverride | null,
): string | null {
  return override?.organizationId ?? getSessionActiveWorkspaceId(session);
}
