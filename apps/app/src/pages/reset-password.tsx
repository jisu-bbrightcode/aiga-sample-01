/**
 * 화면정의서의 data-el 요소 기준으로 구현.
 */

import { useTranslation } from "@repo/core/i18n";
import { useNavigate } from "@tanstack/react-router";
import Lock from "lucide-react/dist/esm/icons/lock";
import { type FormEvent, useState } from "react";
import { authClient } from "../lib/auth-client";
import { getAuthErrorMessage } from "./auth/auth-error-message";
import {
  AuthBrand,
  AuthCard,
  AuthFooter,
  AuthForm,
  AuthHeader,
  AuthPasswordField,
  AuthPrimaryButton,
  AuthShell,
  AuthTextButton,
} from "./auth/auth-layout";

function readResetToken() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get("token") ?? params.get("resetToken");
}

function readResetError() {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("error");
}

export function ResetPasswordPage() {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const [token] = useState(() => readResetToken());
  const [tokenError] = useState(() => readResetError());
  const initialError = token && !tokenError ? null : t("reset.tokenError");

  return (
    <AuthShell>
      <AuthCard dataEl="reset.form-card">
        <AuthBrand />
        <AuthTextButton onClick={() => navigate({ to: "/sign-in" })} data-el="reset.back-link">
          {t("reset.back")}
        </AuthTextButton>
        <AuthHeader title={t("reset.title")} subtitle={t("reset.subtitle")} />

        <ResetPasswordForm
          initialError={initialError}
          onComplete={() => navigate({ to: "/sign-in" })}
          token={token}
        />

        <AuthFooter>
          <AuthTextButton onClick={() => navigate({ to: "/forgot-password" })}>
            {t("reset.requestNew")}
          </AuthTextButton>
        </AuthFooter>
      </AuthCard>
    </AuthShell>
  );
}

function ResetPasswordForm({
  initialError,
  onComplete,
  token,
}: {
  initialError: string | null;
  onComplete: () => void;
  token: string | null;
}) {
  const { t } = useTranslation("auth");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!token) {
      setError(t("reset.tokenError"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("reset.mismatch"));
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const result = await authClient.resetPassword({ newPassword: password, token });
      if (result.error) {
        setError(getAuthErrorMessage(t, result.error, "reset.error"));
        return;
      }
      onComplete();
    } catch {
      setError(t("reset.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthForm onSubmit={handleSubmit} dataEl="reset.password-form">
      <ResetPasswordFields
        confirmPassword={confirmPassword}
        password={password}
        setConfirmPassword={setConfirmPassword}
        setPassword={setPassword}
      />
      {error ? (
        <p className="text-destructive text-base" data-el="reset.error-message">
          {error}
        </p>
      ) : null}
      <AuthPrimaryButton type="submit" loading={loading} disabled={!token} data-el="reset.submit">
        {t("reset.submit")}
      </AuthPrimaryButton>
    </AuthForm>
  );
}

function ResetPasswordFields({
  confirmPassword,
  password,
  setConfirmPassword,
  setPassword,
}: {
  confirmPassword: string;
  password: string;
  setConfirmPassword: (value: string) => void;
  setPassword: (value: string) => void;
}) {
  const { t } = useTranslation("auth");

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <AuthPasswordField
          id="new-password"
          icon={<Lock className="size-3.5" />}
          label={t("reset.newPasswordLabel")}
          hint={t("reset.passwordHint")}
          name="new-password"
          placeholder={t("reset.newPasswordPlaceholder")}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoFocus
          data-el="reset.new-password-input"
          showLabel={t("common.showPassword")}
          hideLabel={t("common.hidePassword")}
        />
        <PasswordMeter value={password} />
      </div>
      <AuthPasswordField
        id="confirm-password"
        icon={<Lock className="size-3.5" />}
        label={t("reset.confirmPasswordLabel")}
        name="confirm-password"
        placeholder={t("reset.confirmPasswordPlaceholder")}
        autoComplete="new-password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        required
        minLength={8}
        data-el="reset.confirm-password-input"
        showLabel={t("common.showPassword")}
        hideLabel={t("common.hidePassword")}
      />
    </>
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
