import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { apiClient } from "@/lib/api";
import { openKcbPopup } from "../lib/open-kcb-popup";

const SESSIONS_PATH = "/api/identity-verifications/kcb/sessions";
const SESSION_PATH = "/api/identity-verifications/kcb/sessions/{sessionId}";
const POPUP_RESULT_MESSAGE_TYPE = "kcb:identity-result";
const ACTIVE_SERVER_STATUSES = ["created", "redirected", "pending"];

export type KcbDemoStatus = "idle" | "pending" | "verified" | "failed" | "canceled" | "expired";

type BlockedInfo = { code?: string; message?: string } | null | undefined;

/**
 * Drives the KCB phone-verification popup flow end to end:
 * create session -> open KCB popup -> poll session status until it resolves.
 * The popup notifies us via same-origin postMessage; polling is the resilient
 * fallback (works even if the message is dropped or the popup is closed early).
 */
// biome-ignore lint/complexity/noExcessiveLinesPerFunction: the popup lifecycle (create -> open -> poll -> resolve) is kept linear so the verification flow reads top to bottom.
export function useKcbIdentityVerification() {
  const queryClient = useQueryClient();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [blockerCode, setBlockerCode] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);

  const sessionQuery = useQuery({
    queryKey: ["kcb-identity-session", sessionId],
    enabled: Boolean(sessionId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && ACTIVE_SERVER_STATUSES.includes(status) ? 2000 : false;
    },
    queryFn: async () => {
      const { data, error } = await apiClient.GET(SESSION_PATH, {
        params: { path: { sessionId: sessionId ?? "" } },
      });
      if (error) throw error;
      return data;
    },
  });

  const createSession = useMutation({
    mutationFn: async () => {
      const { data, error } = await apiClient.POST(SESSIONS_PATH, {
        body: {
          mode: "standard",
          target: { action: "signup" },
        },
      });
      if (error) throw error;
      return data;
    },
  });

  const refetchSession = sessionQuery.refetch;

  async function start() {
    setBlockerCode(null);
    setSessionId(null);
    const session = await createSession.mutateAsync();
    if (!session) return;

    const blocked = session.blocked as BlockedInfo;
    if (blocked?.code) {
      setBlockerCode(blocked.code);
      return;
    }
    if (session.redirectUrl && session.redirectForm) {
      popupRef.current = openKcbPopup({
        url: session.redirectUrl,
        method: session.redirectMethod ?? "POST",
        fields: session.redirectForm,
      });
      setSessionId(session.id);
      return;
    }
    setBlockerCode(session.failureCode ?? "provider_rejected");
  }

  function reset() {
    if (sessionId) {
      queryClient.removeQueries({ queryKey: ["kcb-identity-session", sessionId] });
    }
    setSessionId(null);
    setBlockerCode(null);
    popupRef.current = null;
  }

  // Same-origin message from the popup-return page accelerates the result refresh.
  useEffect(() => {
    if (!sessionId) return;
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; sessionId?: string } | null;
      if (data?.type === POPUP_RESULT_MESSAGE_TYPE && data.sessionId === sessionId) {
        void refetchSession();
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [sessionId, refetchSession]);

  // Fallback: if the user closes the popup manually, refresh once.
  useEffect(() => {
    if (!sessionId) return;
    const timer = window.setInterval(() => {
      if (popupRef.current?.closed) {
        window.clearInterval(timer);
        void refetchSession();
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [sessionId, refetchSession]);

  return {
    status: deriveStatus(sessionId, sessionQuery.data?.status),
    blockerCode,
    start,
    reset,
    isStarting: createSession.isPending,
    startError: createSession.error,
  };
}

function deriveStatus(sessionId: string | null, serverStatus: string | undefined): KcbDemoStatus {
  if (!sessionId) return "idle";
  switch (serverStatus) {
    case "verified":
      return "verified";
    case "failed":
      return "failed";
    case "canceled":
      return "canceled";
    case "expired":
      return "expired";
    default:
      return "pending";
  }
}
