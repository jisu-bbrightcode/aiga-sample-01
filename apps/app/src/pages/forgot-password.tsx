/**
 * 화면정의서의 data-el 요소 기준으로 구현.
 */

import { useTranslation } from "@repo/core/i18n";
import { useNavigate } from "@tanstack/react-router";
import Mail from "lucide-react/dist/esm/icons/mail";
import { type FormEvent, useState } from "react";
import { authCallbackUrl } from "../lib/auth-callback-url";
import { authClient } from "../lib/auth-client";
import { getAuthErrorMessage } from "./auth/auth-error-message";
import {
  AuthBrand,
  AuthCard,
  AuthField,
  AuthFooter,
  AuthForm,
  AuthHeader,
  AuthPrimaryButton,
  AuthShell,
  AuthTextButton,
} from "./auth/auth-layout";

export function ForgotPasswordPage() {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email) return;
    setError(null);
    setLoading(true);

    try {
      const trimmedEmail = email.trim();
      const result = await authClient.requestPasswordReset({
        email: trimmedEmail,
        redirectTo: authCallbackUrl("/reset-password"),
      });
      if (result.error) {
        setError(getAuthErrorMessage(t, result.error, "forgot.error"));
        return;
      }
      setEmail(trimmedEmail);
      setSent(true);
    } catch {
      setError(t("forgot.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <AuthCard dataEl="forgot.form-card">
        <AuthBrand />
        <AuthTextButton onClick={() => navigate({ to: "/sign-in" })} data-el="forgot.back-link">
          {t("forgot.back")}
        </AuthTextButton>
        <AuthHeader title={t("forgot.title")} subtitle={t("forgot.subtitle")} />

        {sent ? (
          <div className="space-y-3 py-2 text-center" data-el="forgot.sent-message">
            <p className="text-muted-foreground text-sm leading-normal">
              {t("forgot.sent", { email })}
            </p>
            <p className="text-muted-foreground text-xs leading-normal">{t("forgot.sentHint")}</p>
          </div>
        ) : (
          <AuthForm onSubmit={handleSubmit} dataEl="forgot.email-form">
            <AuthField
              id="email"
              icon={<Mail className="size-3.5" />}
              label={t("forgot.emailLabel")}
              name="email"
              type="email"
              placeholder={t("forgot.emailPlaceholder")}
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              data-el="forgot.email-input"
            />
            {error ? (
              <p className="text-destructive text-base" data-el="forgot.error-message">
                {error}
              </p>
            ) : null}
            <AuthPrimaryButton type="submit" loading={loading} data-el="forgot.submit">
              {t("forgot.submit")}
            </AuthPrimaryButton>
          </AuthForm>
        )}

        <AuthFooter>
          {t("forgot.noAccess")}{" "}
          <a className="text-primary font-medium hover:underline" href="/support">
            {t("common.support")}
          </a>
        </AuthFooter>
      </AuthCard>
    </AuthShell>
  );
}
