/**
 * 화면정의서의 data-el 요소 기준으로 구현.
 */

import { useTranslation } from "@repo/core/i18n";
import { Button } from "@repo/ui/shadcn/button";
import { useNavigate } from "@tanstack/react-router";
import LoaderCircle from "lucide-react/dist/esm/icons/loader-circle";
import Mail from "lucide-react/dist/esm/icons/mail";
import { useState } from "react";
import { authCallbackUrl } from "../lib/auth-callback-url";
import { authClient } from "../lib/auth-client";
import { authPathWithNext, sanitizeAuthNextPath } from "../lib/auth-next-path";
import { readAuthNotice } from "../lib/auth-notice";
import { AuthBrand, AuthCard, AuthShell, AuthTextButton } from "./auth/auth-layout";

export function MagicLinkPage() {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const [notice] = useState(() => readAuthNotice());
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [resendError, setResendError] = useState(false);

  const isVerificationNotice = notice.mode === "verify-email";
  const noticeEmail = notice.email ?? "you@studio.com";
  const defaultNextPath = isVerificationNotice ? "/workspace-select?next=/onboarding" : "/";
  const nextPath = sanitizeAuthNextPath(notice.nextPath, defaultNextPath);
  const canResendVerification = isVerificationNotice && Boolean(notice.email);

  const handleResend = async () => {
    if (resending || resent) return;
    setResending(true);
    setResendError(false);
    try {
      if (canResendVerification && notice.email) {
        // biome-ignore lint/suspicious/noExplicitAny: sendVerificationEmail 타입이 client 에 노출 안 됨
        await (authClient as any).sendVerificationEmail({
          email: notice.email,
          callbackURL: authCallbackUrl(nextPath),
        });
      } else if (!isVerificationNotice && notice.email) {
        // biome-ignore lint/suspicious/noExplicitAny: magicLink 플러그인 타입이 client 에 노출 안 됨
        await (authClient.signIn as any).magicLink({
          email: notice.email,
          callbackURL: authCallbackUrl(nextPath),
          errorCallbackURL: authCallbackUrl(authPathWithNext("/sign-in", nextPath)),
        });
      }
      setResent(true);
    } catch {
      setResendError(true);
    } finally {
      setResending(false);
    }
  };

  const bodyBeforeEmailKey = isVerificationNotice
    ? "magic.verificationBodyBeforeEmail"
    : "magic.signInBodyBeforeEmail";
  const bodyAfterEmailKey = isVerificationNotice
    ? "magic.verificationBodyAfterEmail"
    : "magic.signInBodyAfterEmail";

  return (
    <AuthShell>
      <AuthCard dataEl="magic.form-card">
        <AuthBrand />
        <div
          className="bg-primary/10 text-primary grid size-14 place-items-center self-center rounded-xl"
          data-el="magic.status-icon"
        >
          <Mail className="size-7" />
        </div>

        <header className="space-y-2 text-center">
          <h1
            className="text-foreground text-2xl leading-[1.3] font-semibold"
            data-el="magic.status-message"
          >
            {t("magic.title")}
          </h1>
          <p className="text-muted-foreground text-sm leading-normal">
            {t(bodyBeforeEmailKey)}
            <span className="text-foreground font-medium" data-el="magic.email-display">
              {noticeEmail}
            </span>
            {t(bodyAfterEmailKey)}
          </p>
        </header>

        <div
          className="border-border-subtle bg-card flex flex-col gap-2.5 rounded-lg border p-3.5"
          data-el="magic.info-box"
        >
          <Tip number="1" title={t("magic.tipOneTitle")} body={t("magic.tipOneBody")} />
          <Tip number="2" title={t("magic.tipTwoTitle")} body={t("magic.tipTwoBody")} />
        </div>

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-input bg-card hover:bg-muted h-9 w-full justify-center rounded-lg"
            onClick={handleResend}
            disabled={
              resending ||
              resent ||
              (isVerificationNotice && !canResendVerification) ||
              (!isVerificationNotice && !notice.email)
            }
            data-el="magic.resend-btn"
          >
            {resending ? <LoaderCircle className="mr-2 size-3.5 animate-spin" /> : null}
            {resent ? t("common.linkSent") : t("magic.resend")}
          </Button>
          {resendError ? (
            <p className="text-destructive text-base" data-el="magic.resend-error">
              {t("magic.resendError")}
            </p>
          ) : null}
          <AuthTextButton onClick={() => navigate({ to: "/sign-in" })} data-el="magic.back-link">
            {t("magic.back")}
          </AuthTextButton>
        </div>
      </AuthCard>
    </AuthShell>
  );
}

function Tip({ body, number, title }: { body: string; number: string; title: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="bg-primary text-primary-foreground grid size-5 shrink-0 place-items-center rounded-full font-mono text-xs font-semibold">
        {number}
      </span>
      <span className="min-w-0">
        <span className="text-foreground block text-base font-medium">{title}</span>
        <span className="text-muted-foreground block text-xs leading-normal">{body}</span>
      </span>
    </div>
  );
}
