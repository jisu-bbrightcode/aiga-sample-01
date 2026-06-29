/**
 * Admin Sign In Page — 이메일/비밀번호 + OAuth 로그인
 */

import LogoSvg from "@repo/ui/assets/svg/logo";
import { Button } from "@repo/ui/shadcn/button";
import { Input } from "@repo/ui/shadcn/input";
import { Label } from "@repo/ui/shadcn/label";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { authClient } from "../../lib/auth-client";
import { getLabels, project } from "../../lib/project";

export function AdminSignInPage() {
  const labels = getLabels();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await authClient.signIn.email({ email, password });
      if (result.error) {
        setError(result.error.message ?? "로그인에 실패했습니다");
      } else {
        navigate({ to: "/" });
      }
    } catch {
      setError("서버에 연결할 수 없습니다");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = (provider: "google" | "apple" | "kakao" | "naver") => {
    authClient.signIn.social({
      provider,
      callbackURL:
        typeof window === "undefined" ? "/" : new URL("/", window.location.origin).toString(),
    });
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <LogoSvg className="size-6" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold tracking-tight">{project.name}</h1>
            <p className="mt-1 text-base text-muted-foreground">{labels.signInSubtitle}</p>
          </div>
        </div>

        {/* OAuth */}
        <div className="mb-6 space-y-2">
          <Button
            variant="outline"
            className="w-full h-10 gap-2 text-base"
            onClick={() => handleOAuth("google")}
          >
            <GoogleIcon />
            Google로 계속하기
          </Button>
          <Button
            variant="outline"
            className="w-full h-10 gap-2 text-base"
            onClick={() => handleOAuth("apple")}
          >
            <AppleIcon />
            Apple로 계속하기
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 h-10 gap-2 text-base"
              onClick={() => handleOAuth("kakao")}
            >
              <KakaoIcon />
              카카오
            </Button>
            <Button
              variant="outline"
              className="flex-1 h-10 gap-2 text-base"
              onClick={() => handleOAuth("naver")}
            >
              <NaverIcon />
              네이버
            </Button>
          </div>
        </div>

        {/* Divider */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-background px-3 text-muted-foreground">또는 이메일로 로그인</span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-base">
              이메일
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-10"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-base">
              비밀번호
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-10"
            />
          </div>

          {error ? <p className="text-base text-destructive">{error}</p> : null}

          <Button type="submit" className="w-full h-10" disabled={loading}>
            {loading ? "로그인 중..." : labels.signInButton}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">{labels.signInNote}</p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * OAuth Icons
 * -----------------------------------------------------------------------------------------------*/

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

function KakaoIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4">
      <path
        d="M12 3C6.48 3 2 6.44 2 10.65c0 2.68 1.78 5.04 4.46 6.38-.16.56-.57 2.03-.65 2.34-.11.38.14.38.29.28.12-.08 1.87-1.27 2.63-1.79.74.11 1.5.17 2.27.17 5.52 0 10-3.44 10-7.68C22 6.44 17.52 3 12 3z"
        fill="#3C1E1E"
      />
    </svg>
  );
}

function NaverIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4">
      <path
        d="M16.27 3H7.73A4.73 4.73 0 0 0 3 7.73v8.54A4.73 4.73 0 0 0 7.73 21h8.54A4.73 4.73 0 0 0 21 16.27V7.73A4.73 4.73 0 0 0 16.27 3zm.77 12.35h-2.63l-3.6-4.92v4.92H8.18V8.65h2.63l3.6 4.92V8.65h2.63v6.7z"
        fill="#03C75A"
      />
    </svg>
  );
}
