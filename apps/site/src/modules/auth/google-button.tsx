"use client";

import { getAuthClient } from "@repo/core/auth";
import { Button } from "@repo/ui/shadcn/button";

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3a12 12 0 1 1-3.3-12.6l5.7-5.7A20 20 0 1 0 44 24c0-1.2-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8A12 12 0 0 1 24 12c3 0 5.8 1.1 8 3l5.7-5.7A20 20 0 0 0 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44a20 20 0 0 0 13.4-5.2l-6.2-5.2A12 12 0 0 1 12.7 28l-6.5 5A20 20 0 0 0 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C41 35.6 44 30.3 44 24c0-1.2-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}

export function GoogleButton({ onError }: { onError: (message: string) => void }) {
  const onClick = async () => {
    try {
      await getAuthClient().signIn.social({
        provider: "google",
        callbackURL: window.location.href,
      });
    } catch {
      onError("구글 로그인을 시작할 수 없어요.");
    }
  };
  return (
    <Button type="button" variant="outline" className="h-9 w-full gap-2" onClick={onClick}>
      <GoogleIcon />
      <span>Google로 계속하기</span>
    </Button>
  );
}
