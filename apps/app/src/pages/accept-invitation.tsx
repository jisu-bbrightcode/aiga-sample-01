import type { AuthErrorLike } from "@repo/core/auth/error-codes";
import { useTranslation } from "@repo/core/i18n";
import { Button } from "@repo/ui/shadcn/button";
import { useNavigate } from "@tanstack/react-router";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import MailCheck from "lucide-react/dist/esm/icons/mail-check";
import { useState } from "react";
import { AppQuietLoadingState } from "@/components/app-loading";
import { authClient } from "../lib/auth-client";
import { getCurrentAuthPath } from "../lib/auth-next-path";
import { getAuthErrorMessage } from "./auth/auth-error-message";
import {
  AuthBrand,
  AuthCard,
  AuthFooter,
  AuthHeader,
  AuthPrimaryButton,
  AuthShell,
  AuthTextButton,
} from "./auth/auth-layout";

interface AuthMutationResult<T> {
  data?: T | null;
  error?: unknown;
}

type InvitationAuthClient = typeof authClient & {
  useListOrganizations: () => {
    refetch?: () => Promise<unknown>;
  };
  organization: {
    acceptInvitation: (input: { invitationId: string }) => Promise<AuthMutationResult<unknown>>;
  };
};

const invitationAuthClient = authClient as unknown as InvitationAuthClient;

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: Auth invitation screen keeps session states and CTA wiring together.
export function AcceptInvitationPage() {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const sessionQuery = authClient.useSession();
  const organizationsQuery = invitationAuthClient.useListOrganizations();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invitationId =
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("id");
  const nextPath = getCurrentAuthPath();
  const user = sessionQuery.data?.user;

  const goToAuth = (to: "/sign-in" | "/sign-up") => {
    navigate({ to, search: { next: nextPath } });
  };

  const handleAccept = async () => {
    if (!invitationId) {
      setError(t("acceptInvitation.invalidLink"));
      return;
    }

    setPending(true);
    setError(null);
    try {
      const result = await invitationAuthClient.organization.acceptInvitation({ invitationId });
      if (result.error) {
        setError(getAuthErrorMessage(t, result.error as AuthErrorLike, "acceptInvitation.error"));
        return;
      }
      await Promise.all([sessionQuery.refetch?.(), organizationsQuery.refetch?.()]);
      navigate({ to: "/" });
    } catch {
      setError(t("common.serverUnavailable"));
    } finally {
      setPending(false);
    }
  };

  if (sessionQuery.isPending) {
    return (
      <AuthShell>
        <AuthCard dataEl="accept-invitation.loading-card">
          <AuthBrand />
          <AppQuietLoadingState
            className="py-1"
            label={null}
            loaderLabel={t("acceptInvitation.loadingTitle")}
            variant="inline"
          />
          <AuthHeader
            title={t("acceptInvitation.loadingTitle")}
            subtitle={t("acceptInvitation.loadingSubtitle")}
          />
        </AuthCard>
      </AuthShell>
    );
  }

  if (!user) {
    return (
      <AuthShell>
        <AuthCard dataEl="accept-invitation.auth-card">
          <AuthBrand />
          <div className="bg-primary/10 text-primary grid size-14 place-items-center self-center rounded-xl">
            <MailCheck className="size-7" />
          </div>
          <AuthHeader
            title={t("acceptInvitation.title")}
            subtitle={t("acceptInvitation.signedOutSubtitle")}
          />
          <div className="flex flex-col gap-2">
            <AuthPrimaryButton type="button" onClick={() => goToAuth("/sign-in")}>
              {t("acceptInvitation.signIn")}
            </AuthPrimaryButton>
            <Button
              type="button"
              variant="outline"
              className="border-input bg-card hover:bg-muted h-9 w-full justify-center rounded-lg"
              onClick={() => goToAuth("/sign-up")}
            >
              {t("acceptInvitation.createAccount")}
            </Button>
          </div>
          <p className="text-muted-foreground text-center text-base leading-normal">
            {t("acceptInvitation.emailHint")}
          </p>
        </AuthCard>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthCard dataEl="accept-invitation.form-card">
        <AuthBrand />
        <div className="bg-primary/10 text-primary grid size-14 place-items-center self-center rounded-xl">
          <CheckCircle2 className="size-7" />
        </div>
        <AuthHeader
          title={t("acceptInvitation.title")}
          subtitle={t("acceptInvitation.signedInSubtitle", { email: user.email })}
        />

        {error ? <p className="text-destructive text-center text-base">{error}</p> : null}

        <AuthPrimaryButton
          type="button"
          onClick={handleAccept}
          loading={pending}
          disabled={!invitationId}
          data-el="accept-invitation.submit"
        >
          {t("acceptInvitation.accept")}
        </AuthPrimaryButton>

        <AuthFooter dataEl="accept-invitation.footer">
          <AuthTextButton onClick={() => navigate({ to: "/workspace-select" })}>
            {t("acceptInvitation.chooseWorkspace")}
          </AuthTextButton>
        </AuthFooter>
      </AuthCard>
    </AuthShell>
  );
}
