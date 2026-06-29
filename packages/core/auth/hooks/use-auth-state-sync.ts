/**
 * Auth State Sync Hook — Better Auth
 *
 * Web cookie 기반 session 상태를 Jotai atom 에 동기화한다.
 */

import { useSetAtom } from "jotai";
import { useEffect } from "react";
import { getAuthClient } from "../auth-client";
import { authenticatedAtom, sessionAtom, tokenAtom } from "../store";

export function useAuthStateSync() {
  const setSession = useSetAtom(sessionAtom);
  const setAuthenticated = useSetAtom(authenticatedAtom);
  const setToken = useSetAtom(tokenAtom);

  const authClient = getAuthClient();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (isPending) return;

    if (session?.user) {
      setSession({ token: session.session.token, user: session.user });
      setToken(session.session.token);
      setAuthenticated(true);
    } else {
      setSession(null);
      setToken(null);
      setAuthenticated(false);
    }
  }, [session, isPending, setSession, setAuthenticated, setToken]);
}
