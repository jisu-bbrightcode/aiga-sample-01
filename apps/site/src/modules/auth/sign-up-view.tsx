"use client";

import { getAuthClient } from "@repo/core/auth";
import { Button } from "@repo/ui/shadcn/button";
import { Input } from "@repo/ui/shadcn/input";
import { Label } from "@repo/ui/shadcn/label";
import { type FormEvent, useState } from "react";
import { siteConfig } from "@/config/site.config";
import { AUTH_SERVER_UNAVAILABLE, authErrorMessage } from "./auth-messages";
import { useAuthModal } from "./auth-modal-store";
import { GoogleButton } from "./google-button";
import { useApplySession } from "./session-helpers";

export function SignUpView() {
  const providers = siteConfig.modules.auth?.providers ?? {
    email: true,
    google: false,
    magicLink: false,
  };
  const applySession = useApplySession();
  const { close, setView } = useAuthModal();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const res = await getAuthClient().signUp.email({ email, password, name });
      if (res.error) {
        setError(authErrorMessage(res.error));
        setLoading(false);
        return;
      }
      // Some configurations sign the user in immediately (token present); others
      // require email verification first.
      const data = res.data as { token?: string; user?: { id: string; email: string; name: string } } | null;
      if (data?.token && data.user) {
        applySession({ token: data.token, user: data.user });
        close();
        return;
      }
      setNotice("가입이 거의 끝났어요. 받은 메일의 인증 링크를 눌러 주세요.");
      setLoading(false);
    } catch {
      setError(AUTH_SERVER_UNAVAILABLE);
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {providers.google ? <GoogleButton onError={setError} /> : null}

      {providers.email ? (
        <form className="flex flex-col gap-3" onSubmit={onSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="signup-name">이름</Label>
            <Input
              id="signup-name"
              autoComplete="name"
              placeholder="이름"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="signup-email">이메일</Label>
            <Input
              id="signup-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="signup-password">비밀번호</Label>
            <Input
              id="signup-password"
              type="password"
              autoComplete="new-password"
              placeholder="8자 이상"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="h-9 w-full" disabled={loading}>
            {loading ? "가입 중…" : "회원가입"}
          </Button>
        </form>
      ) : null}

      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {notice ? <p className="text-muted-foreground text-sm">{notice}</p> : null}

      <p className="text-muted-foreground text-center text-sm">
        이미 계정이 있나요?{" "}
        <button
          type="button"
          className="text-foreground font-medium underline underline-offset-2"
          onClick={() => setView("sign-in")}
        >
          로그인
        </button>
      </p>
    </div>
  );
}
