"use client";

import { authenticatedAtom, getAuthClient, sessionAtom } from "@repo/core/auth";
import { Button } from "@repo/ui/shadcn/button";
import { useAtomValue, useSetAtom } from "jotai";
import { useAuthModal } from "./auth-modal-store";

/** Header control: login/signup buttons when signed out, user + logout when in. */
export function LoginButton() {
  const authenticated = useAtomValue(authenticatedAtom);
  const session = useAtomValue(sessionAtom);
  const setSession = useSetAtom(sessionAtom);
  const { openAuthModal } = useAuthModal();

  const onLogout = async () => {
    try {
      await getAuthClient().signOut();
    } catch {
      // ignore — clear local state regardless
    }
    setSession(null);
  };

  if (authenticated && session?.user) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-foreground text-sm">
          {session.user.name || session.user.email}
        </span>
        <Button type="button" variant="outline" size="sm" onClick={onLogout}>
          로그아웃
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="ghost" size="sm" onClick={() => openAuthModal("sign-in")}>
        로그인
      </Button>
      <Button type="button" size="sm" onClick={() => openAuthModal("sign-up")}>
        회원가입
      </Button>
    </div>
  );
}
