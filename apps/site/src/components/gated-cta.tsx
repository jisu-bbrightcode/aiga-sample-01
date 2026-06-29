"use client";

import { authenticatedAtom } from "@repo/core/auth";
import { Button } from "@repo/ui/shadcn/button";
import { useAtomValue } from "jotai";
import { useAuthModal } from "@/modules/auth/auth-modal-store";

/**
 * Demonstrates the gated-action pattern: a public page action that opens the
 * auth modal when the visitor is not signed in, instead of redirecting away.
 */
export function GatedCta() {
  const authenticated = useAtomValue(authenticatedAtom);
  const { openAuthModal } = useAuthModal();

  const onClick = () => {
    if (!authenticated) {
      openAuthModal("sign-in");
      return;
    }
    // Authenticated path — wire a real protected action here.
    window.alert("인증됨 — 보호된 동작을 실행할 수 있어요.");
  };

  return (
    <Button type="button" onClick={onClick}>
      글 작성하기 (인증 필요)
    </Button>
  );
}
