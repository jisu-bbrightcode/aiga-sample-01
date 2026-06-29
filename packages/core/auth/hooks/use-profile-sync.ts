/**
 * Profile Sync Hook — Better Auth
 */

import { useAtomValue, useSetAtom } from "jotai";
import { useEffect } from "react";
import { getAuthClient } from "../auth-client";
import { authenticatedAtom, profileAtom } from "../store";

type ActiveOrganizationClient = {
  useActiveOrganization: () => {
    data?: {
      members?: Array<{ userId: string; role?: string | null }>;
    } | null;
  };
};

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

export function useProfileSync() {
  const authenticated = useAtomValue(authenticatedAtom);
  const setProfile = useSetAtom(profileAtom);

  const authClient = getAuthClient();
  const { data: session } = authClient.useSession();
  const { data: activeOrg } = (
    authClient as unknown as ActiveOrganizationClient
  ).useActiveOrganization();

  useEffect(() => {
    if (!authenticated || !session?.user) {
      setProfile(null);
      return;
    }

    const user = session.user;
    const currentMember = activeOrg?.members?.find((m: { userId: string }) => m.userId === user.id);
    const memberRole = (currentMember?.role as "owner" | "admin" | "member" | null) ?? null;

    setProfile({
      id: user.id,
      name: user.name || "",
      email: user.email,
      avatar: user.image ?? null,
      role: memberRole,
      createdAt: toDate(user.createdAt as Date | string | null | undefined),
      updatedAt: toDate(user.updatedAt as Date | string | null | undefined),
    });
  }, [authenticated, session, activeOrg, setProfile]);
}
