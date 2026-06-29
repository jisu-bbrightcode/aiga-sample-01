"use client";

import { authenticatedAtom } from "@repo/core/auth";
import { Button } from "@repo/ui/shadcn/button";
import { useAtomValue } from "jotai";
import { useAuthModal } from "@/modules/auth/auth-modal-store";

interface GatedActionButtonProps {
  label: string;
  /** Message surfaced to an already-authenticated visitor (placeholder for the
   *  real protected action — save/bookmark/booking — wired in a later feature). */
  authedMessage?: string;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm" | "lg";
  className?: string;
}

/**
 * Public-page CTA that gates a protected action behind the auth modal instead
 * of redirecting to a login page. Unauthenticated → open the sign-in modal in
 * place; authenticated → run the protected action. Reused by detail pages and
 * the pricing/conversion CTA.
 */
export function GatedActionButton({
  label,
  authedMessage = "인증되었습니다 — 보호된 동작을 실행할 수 있어요.",
  variant = "default",
  size = "default",
  className,
}: GatedActionButtonProps) {
  const authenticated = useAtomValue(authenticatedAtom);
  const { openAuthModal } = useAuthModal();

  const onClick = () => {
    if (!authenticated) {
      openAuthModal("sign-in");
      return;
    }
    window.alert(authedMessage);
  };

  return (
    <Button type="button" variant={variant} size={size} className={className} onClick={onClick}>
      {label}
    </Button>
  );
}
