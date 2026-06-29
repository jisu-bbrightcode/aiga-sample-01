"use client";

import { initAuthClient, useAuthStateSync } from "@repo/core/auth";
import { type ReactNode, useEffect, useState } from "react";
import { API_URL } from "@/lib/auth-headers";
import { AuthModal } from "./auth-modal";

let clientReady = false;
function ensureAuthClient() {
  if (!clientReady) {
    initAuthClient(API_URL);
    clientReady = true;
  }
}

/** Syncs the better-auth session into the shared atoms. Client-only. */
function AuthSync() {
  useAuthStateSync();
  return null;
}

/**
 * Auth module provider. Initializes the better-auth client and runs session
 * sync after mount (so it never executes during SSR, where the client isn't
 * initialized). Also mounts the global auth modal.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    ensureAuthClient();
    setReady(true);
  }, []);

  return (
    <>
      {ready ? <AuthSync /> : null}
      {children}
      {ready ? <AuthModal /> : null}
    </>
  );
}
