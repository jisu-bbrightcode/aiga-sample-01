/**
 * 화면정의서의 data-el 요소 기준으로 구현.
 */

import { useTranslation } from "@repo/core/i18n";
import { Button } from "@repo/ui/shadcn/button";
import { Checkbox } from "@repo/ui/shadcn/checkbox";
import { Label } from "@repo/ui/shadcn/label";
import { useNavigate } from "@tanstack/react-router";
import Lock from "lucide-react/dist/esm/icons/lock";
import Mail from "lucide-react/dist/esm/icons/mail";
import User from "lucide-react/dist/esm/icons/user";
import { type FormEvent, useState } from "react";
import { authCallbackUrl } from "../lib/auth-callback-url";
import { authClient } from "../lib/auth-client";
import { getAuthNextPath } from "../lib/auth-next-path";
import { writeAuthNotice } from "../lib/auth-notice";
import { startOAuth } from "../lib/oauth-start";
import { getAuthErrorMessage } from "./auth/auth-error-message";
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

export function SignUpPage() {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const nextPath = getAuthNextPath("/workspace-select?next=/onboarding");

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!agree) return;
    setError(null);
    setLoading(true);

    try {
      const trimmedName = name.trim();
      const trimmedEmail = email.trim();
      const result = await authClient.signUp.email({
        name: trimmedName,
        email: trimmedEmail,
        password,
        callbackURL: authCallbackUrl(nextPath),
      });
      if (result.error) {
        setError(getAuthErrorMessage(t, result.error, "signUp.error"));
      } else {
        writeAuthNotice({ email: trimmedEmail, mode: "verify-email", nextPath });
        navigate({ to: "/magic-link" });
      }
    } catch {
      setError(t("common.serverUnavailable"));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = () => {
    setSocialLoading("google");
    void startOAuth({
      provider: "google",
      callbackURL: authCallbackUrl(nextPath),
    });
  };

  return (
    <AuthShell>
      <AuthCard dataEl="signup.form-card">
        <AuthBrand />
        <AuthHeader title={t("signUp.title")} subtitle={t("signUp.subtitle")} />

        <Button
          type="button"
          variant="outline"
          className="border-input bg-card hover:bg-muted h-9 w-full gap-2 rounded-lg text-sm font-medium"
          onClick={handleGoogleSignUp}
          disabled={socialLoading === "google"}
          data-el="signup.google"
        >
          <GoogleIcon />
          <span>{t("signUp.google")}</span>
        </Button>

        <AuthDivider>{t("signUp.divider")}</AuthDivider>

        <AuthForm onSubmit={handleSubmit} dataEl="signup.email-form">
          <AuthField
            id="name"
            icon={<User className="size-3.5" />}
            label={t("signUp.nameLabel")}
            hint={t("signUp.nameHint")}
            name="name"
            type="text"
            placeholder={t("signUp.namePlaceholder")}
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
            data-el="signup.name-input"
          />
          <AuthField
            id="email"
            icon={<Mail className="size-3.5" />}
            label={t("signUp.emailLabel")}
            name="email"
            type="email"
            placeholder={t("signUp.emailPlaceholder")}
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            data-el="signup.email-input"
          />
          <div className="flex flex-col gap-1.5">
            <AuthPasswordField
              id="password"
              icon={<Lock className="size-3.5" />}
              label={t("signUp.passwordLabel")}
              hint={t("signUp.passwordHint")}
              name="password"
              placeholder={t("signUp.passwordPlaceholder")}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              data-el="signup.password-input"
              showLabel={t("common.showPassword")}
              hideLabel={t("common.hidePassword")}
            />
            <PasswordMeter value={password} />
          </div>

          <div className="text-muted-foreground inline-flex items-center gap-2 text-base leading-normal">
            <Checkbox
              id="signup-agree"
              checked={agree}
              onCheckedChange={(value) => setAgree(value === true)}
              aria-labelledby="signup-agree-label"
              data-el="signup.agree-checkbox"
            />
            <Label
              id="signup-agree-label"
              className="cursor-pointer text-base leading-normal font-normal"
              onClick={() => setAgree((current) => !current)}
            >
              {t("signUp.agree")}
            </Label>
          </div>

          {error ? (
            <p className="text-destructive text-base" data-el="signup.error-message">
              {error}
            </p>
          ) : null}

          <AuthPrimaryButton
            type="submit"
            loading={loading}
            disabled={!agree}
            data-el="signup.submit"
          >
            {t("signUp.submit")}
          </AuthPrimaryButton>
        </AuthForm>

        <AuthFooter dataEl="signup.footer-login">
          {t("signUp.haveAccount")}{" "}
          <AuthTextButton
            onClick={() =>
              navigate({
                to: "/sign-in",
                search:
                  nextPath === "/workspace-select?next=/onboarding"
                    ? undefined
                    : { next: nextPath },
              })
            }
          >
            {t("signUp.signIn")}
          </AuthTextButton>
        </AuthFooter>
      </AuthCard>
    </AuthShell>
  );
}

function getPasswordScore(password: string) {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return Math.min(4, score);
}

function PasswordMeter({ value }: { value: string }) {
  const { t } = useTranslation("auth");
  const score = getPasswordScore(value);
  if (!value) return null;

  const labels = [
    "",
    t("passwordScore.weak"),
    t("passwordScore.fair"),
    t("passwordScore.strong"),
    t("passwordScore.excellent"),
  ];

  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-1 gap-1">
        {[1, 2, 3, 4].map((index) => (
          <span key={index} className={meterClassName(index <= score, score)} aria-hidden="true" />
        ))}
      </div>
      <span className="text-muted-foreground min-w-16 text-right text-xs font-medium">
        {labels[score]}
      </span>
    </div>
  );
}

function meterClassName(active: boolean, score: number) {
  if (!active) return "h-1 flex-1 rounded-sm bg-muted";
  if (score === 1) return "h-1 flex-1 rounded-sm bg-destructive";
  if (score === 2) return "h-1 flex-1 rounded-sm bg-entity-faction";
  if (score === 3) return "h-1 flex-1 rounded-sm bg-entity-world";
  return "h-1 flex-1 rounded-sm bg-entity-location";
}
