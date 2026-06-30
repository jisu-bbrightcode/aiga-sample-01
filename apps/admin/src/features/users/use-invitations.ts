/**
 * useInvitations — pending operator invitations for the invite console
 * (PB-ADMIN-USERS-CREATE-001 / BBR-687).
 *
 * Loads the organization's pending invitations and exposes a manual refetch so
 * the panel can refresh after a successful invite. Failures surface a friendly,
 * non-technical message (never raw server detail).
 */
import { useEffect, useState } from "react";
import { fetchInvitations, type Invitation } from "./api";

const LIST_ERROR_MESSAGE = "초대 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";

export function useInvitations() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadToken is a deliberate manual-refetch trigger.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchInvitations("pending");
        if (cancelled) return;
        setInvitations(data.invitations);
      } catch {
        if (!cancelled) setError(LIST_ERROR_MESSAGE);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  return {
    invitations,
    loading,
    error,
    refetch: () => setReloadToken((t) => t + 1),
  };
}
