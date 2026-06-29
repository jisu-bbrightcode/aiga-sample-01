/**
 * 화면정의서의 data-el 요소 기준으로 구현.
 */

import { authenticatedAtom, sessionAtom, tokenAtom } from "@repo/core/auth";
import { AUTH_ERROR_CODES } from "@repo/core/auth/error-codes";
import { useTranslation } from "@repo/core/i18n";
import { Button } from "@repo/ui/shadcn/button";
import { Checkbox } from "@repo/ui/shadcn/checkbox";
import { Label } from "@repo/ui/shadcn/label";
import { useNavigate } from "@tanstack/react-router";
import { useAtomValue, useSetAtom } from "jotai";
import Lock from "lucide-react/dist/esm/icons/lock";
import Mail from "lucide-react/dist/esm/icons/mail";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import { useState, useEffect } from "react";
import { authCallbackUrl } from "../lib/auth-callback-url";
import { authClient } from "../lib/auth-client";
import { authPathWithNext, getAuthNextPath } from "../lib/auth-next-path";
import { writeAuthNotice } from "../lib/auth-notice";
import { startOAuth } from "../lib/oauth-start";
import { authErrorMatches, getAuthErrorMessage } from "./auth/auth-error-message";
import {
  AuthBrand,
  AuthCard,
  AuthDivider,
  AuthField,
  AuthFooter,
  AuthForm,
  AuthHeader,
  AuthPasswordField,
  AuthPrimaryButton,
  AuthShell,
  AuthTextButton,
  GoogleIcon,
} from "./auth/auth-layout";

function toSessionDate(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return undefined;
}

export function SignInPage() {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const setSession = useSetAtom(sessionAtom);
  const setAuthenticated = useSetAtom(authenticatedAtom);
  const setToken = useSetAtom(tokenAtom);
  const authenticated = useAtomValue(authenticatedAtom);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState<string | null>(null);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [loading, setLoading] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const nextPath = getAuthNextPath("/");

  // 인증된 상태로 sign-in 페이지 진입 시 자동 navigate.
  // OAuth callback 후 main 이 renderer reload — `useAuthStateSync` 가 sessionAtom 을
  // hydrate 한 다음 이 effect 가 dashboard 로 보낸다.
  useEffect(() => {
    if (authenticated === true) {
      navigate({ to: nextPath as never });
    }
  }, [authenticated, navigate, nextPath]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNeedsVerification(null);
    setResendState("idle");
    setLoading(true);

    try {
      const result = await authClient.signIn.email({ email, password });
      if (result.error) {
        if (authErrorMatches(result.error, AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED)) {
          setNeedsVerification(email);
        } else {
          setError(getAuthErrorMessage(t, result.error, "signIn.error"));
        }
        setLoading(false);
        return;
      }
      if (!result.data?.token || !result.data.user) {
        setError(t("signIn.error"));
        setLoading(false);
        return;
      }

      setSession({
        token: result.data.token,
        user: {
          id: result.data.user.id,
          email: result.data.user.email,
          name: result.data.user.name,
          image: result.data.user.image,
          createdAt: toSessionDate(result.data.user.createdAt),
          updatedAt: toSessionDate(result.data.user.updatedAt),
        },
      });
      setToken(result.data.token);
      setAuthenticated(true);
      navigate({ to: nextPath as never });
    } catch {
      setError(t("common.serverUnavailable"));
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!needsVerification || resendState === "sending") return;
    setResendState("sending");
    try {
      // biome-ignore lint/suspicious/noExplicitAny: sendVerificationEmail 타입이 client 에 노출 안 됨
      await (authClient as any).sendVerificationEmail({
        email: needsVerification,
        callbackURL: authCallbackUrl(nextPath),
      });
      setResendState("sent");
    } catch {
      setResendState("error");
    }
  };

  const handleGoogleSignIn = () => {
    setSocialLoading("google");
    void startOAuth({ provider: "google", callbackURL: authCallbackUrl(nextPath) });
  };

  const handleMagicLinkSignIn = async () => {
    const trimmedEmail = email.trim();
    setError(null);
    setNeedsVerification(null);
    setResendState("idle");

    if (!trimmedEmail) {
      setError(t("signIn.magicLinkEmailRequired"));
      return;
    }

    setMagicLinkLoading(true);
    try {
      // biome-ignore lint/suspicious/noExplicitAny: magicLink 플러그인 타입이 client 에 노출 안 됨
      const result = await (authClient.signIn as any).magicLink({
        email: trimmedEmail,
        callbackURL: authCallbackUrl(nextPath),
        errorCallbackURL: authCallbackUrl(authPathWithNext("/sign-in", nextPath)),
      });
      if (result.error) {
        setError(getAuthErrorMessage(t, result.error, "signIn.magicLinkError"));
        return;
      }
      writeAuthNotice({ email: trimmedEmail, mode: "magic-link", nextPath });
      navigate({ to: "/magic-link" });
    } catch {
      setError(t("common.serverUnavailable"));
    } finally {
      setMagicLinkLoading(false);
    }
  };

  return (
    <AuthShell>
      <AuthCard dataEl="login.form-card">
        <AuthBrand />
        <AuthHeader title={t("signIn.title")} subtitle={t("signIn.subtitle")} />

        <Button
          type="button"
          variant="outline"
          className="border-input bg-card hover:bg-muted h-9 w-full gap-2 rounded-lg text-sm font-medium"
          onClick={handleGoogleSignIn}
          disabled={socialLoading === "google"}
          data-el="login.google"
        >
          <GoogleIcon />
          <span>{t("signIn.google")}</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          className="border-input bg-card hover:bg-muted h-9 w-full gap-2 rounded-lg text-sm font-medium"
          onClick={handleMagicLinkSignIn}
          disabled={magicLinkLoading || loading}
          data-el="login.magic-link"
        >
          <Sparkles className="size-3.5" />
          <span>{magicLinkLoading ? t("signIn.magicLinkSending") : t("signIn.magicLink")}</span>
        </Button>

        <AuthDivider>{t("signIn.oauthDivider")}</AuthDivider>

        <AuthForm onSubmit={handleSubmit}>
          <AuthField
            id="email"
            icon={<Mail className="size-3.5" />}
            label={t("signIn.emailLabel")}
            name="email"
            type="email"
            placeholder={t("signIn.emailPlaceholder")}
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            data-el="login.email-input"
          />
          <AuthPasswordField
            id="password"
            icon={<Lock className="size-3.5" />}
            label={t("signIn.passwordLabel")}
            name="password"
            placeholder={t("signIn.passwordPlaceholder")}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            data-el="login.password-input"
            showLabel={t("common.showPassword")}
            hideLabel={t("common.hidePassword")}
          />

          <div className="flex items-center justify-between gap-3">
            <div className="text-muted-foreground inline-flex items-center gap-2 text-base">
              <Checkbox
                id="signin-remember"
                checked={remember}
                onCheckedChange={(value) => setRemember(value === true)}
                aria-labelledby="signin-remember-label"
              />
              <Label
                id="signin-remember-label"
                className="cursor-pointer text-base leading-normal font-normal"
                onClick={() => setRemember((current) => !current)}
              >
                {t("signIn.remember")}
              </Label>
            </div>
            <AuthTextButton
              onClick={() => navigate({ to: "/forgot-password" })}
              data-el="login.forgot-link"
            >
              {t("signIn.forgotPassword")}
            </AuthTextButton>
          </div>

          {error ? (
            <p className="text-destructive text-base" data-el="login.error-message">
              {error}
            </p>
          ) : null}

          {needsVerification ? (
            <div
              className="border-border-subtle bg-card text-muted-foreground rounded-lg border p-3 text-base leading-normal"
              data-el="login.email-not-verified"
            >
              <p className="text-foreground mb-1 font-semibold">
                {t("signIn.emailNotVerifiedTitle")}
              </p>
              <p>{t("signIn.emailNotVerifiedBody", { email: needsVerification })}</p>
              <div className="mt-2">
                {resendState === "sent" && (
                  <span className="text-primary" data-el="login.resend-sent">
                    {t("signIn.verificationSent")}
                  </span>
                )}
                {resendState === "error" && (
                  <span className="text-destructive" data-el="login.resend-error">
                    {t("signIn.verificationError")}
                  </span>
                )}
                {resendState !== "sent" && resendState !== "error" && (
                  <AuthTextButton
                    onClick={handleResendVerification}
                    disabled={resendState === "sending"}
                    data-el="login.resend-btn"
                  >
                    {resendState === "sending"
                      ? t("signIn.resendingVerification")
                      : t("signIn.resendVerification")}
                  </AuthTextButton>
                )}
              </div>
            </div>
          ) : null}

          <AuthPrimaryButton type="submit" loading={loading} data-el="login.submit-btn">
            {t("signIn.submit")}
          </AuthPrimaryButton>
        </AuthForm>

        <AuthFooter dataEl="login.signup-link">
          {t("signIn.noAccount")}{" "}
          <AuthTextButton
            onClick={() =>
              navigate({
                to: "/sign-up",
                search: nextPath === "/" ? undefined : { next: nextPath },
              })
            }
          >
            {t("signIn.createAccount")}
          </AuthTextButton>
        </AuthFooter>

        <p className="text-muted-foreground text-center text-xs leading-normal">
          {t("signIn.termsPrefix")}{" "}
          <a className="text-foreground underline underline-offset-2" href="/terms">
            {t("common.terms")}
          </a>{" "}
          {t("signIn.termsJoin")}{" "}
          <a className="text-foreground underline underline-offset-2" href="/privacy">
            {t("common.privacy")}
          </a>
          .
        </p>
      </AuthCard>
    </AuthShell>
  );
}
