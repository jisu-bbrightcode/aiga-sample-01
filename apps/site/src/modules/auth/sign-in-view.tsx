"use client";

import { getAuthClient } from "@repo/core/auth";
import { Button } from "@repo/ui/shadcn/button";
import { Input } from "@repo/ui/shadcn/input";
import { Label } from "@repo/ui/shadcn/label";
import { Sparkles } from "lucide-react";
import { type FormEvent, useState } from "react";
import { siteConfig } from "@/config/site.config";
import { AUTH_SERVER_UNAVAILABLE, authErrorMessage } from "./auth-messages";
import { useAuthModal } from "./auth-modal-store";
import { GoogleButton } from "./google-button";
import { useApplySession } from "./session-helpers";

export function SignInView() {
  const providers = siteConfig.modules.auth?.providers ?? {
    email: true,
    google: false,
    magicLink: false,
  };
  const applySession = useApplySession();
  const { close, setView } = useAuthModal();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const res = await getAuthClient().signIn.email({ email, password });
      if (res.error) {
        setError(authErrorMessage(res.error));
        setLoading(false);
        return;
      }
      if (!res.data?.token || !res.data.user) {
        setError(authErrorMessage(null));
        setLoading(false);
        return;
      }
      applySession({ token: res.data.token, user: res.data.user });
      close();
    } catch {
      setError(AUTH_SERVER_UNAVAILABLE);
      setLoading(false);
    }
  };

  const onMagicLink = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setError("이메일을 입력해 주세요.");
      return;
    }
    setError(null);
    setNotice(null);
    setMagicLoading(true);
    try {
      // magicLink plugin type is not surfaced on the client type.
      const res = await (
        getAuthClient().signIn as unknown as {
          magicLink: (args: { email: string; callbackURL: string }) => Promise<{ error?: unknown }>;
        }
      ).magicLink({ email: trimmed, callbackURL: window.location.href });
      if (res?.error) {
        setError("매직 링크를 보낼 수 없어요. 잠시 후 다시 시도해 주세요.");
      } else {
        setNotice("로그인 링크를 이메일로 보냈어요. 메일함을 확인해 주세요.");
      }
    } catch {
      setError(AUTH_SERVER_UNAVAILABLE);
    } finally {
      setMagicLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {providers.google ? <GoogleButton onError={setError} /> : null}

      {providers.magicLink ? (
        <Button
          type="button"
          variant="outline"
          className="h-9 w-full gap-2"
          onClick={onMagicLink}
          disabled={magicLoading}
        >
          <Sparkles className="size-3.5" />
          <span>{magicLoading ? "보내는 중…" : "Magic Link 이메일로 받기"}</span>
        </Button>
      ) : null}

      {providers.email ? (
        <form className="flex flex-col gap-3" onSubmit={onSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="signin-email">이메일</Label>
            <Input
              id="signin-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="signin-password">비밀번호</Label>
            <Input
              id="signin-password"
              type="password"
              autoComplete="current-password"
              placeholder="비밀번호를 입력하세요"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="h-9 w-full" disabled={loading}>
            {loading ? "로그인 중…" : "로그인"}
          </Button>
        </form>
      ) : null}

      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {notice ? <p className="text-muted-foreground text-sm">{notice}</p> : null}

      <p className="text-muted-foreground text-center text-sm">
        계정이 없나요?{" "}
        <button
          type="button"
          className="text-foreground font-medium underline underline-offset-2"
          onClick={() => setView("sign-up")}
        >
          회원가입
        </button>
      </p>
    </div>
  );
}
