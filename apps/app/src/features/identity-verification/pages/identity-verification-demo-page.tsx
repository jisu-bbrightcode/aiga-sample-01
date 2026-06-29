import { useFeatureTranslation } from "@repo/core/i18n";
import { KcbIdentityGate, KcbReturnPanel } from "@repo/features/identity-verification/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/shadcn/card";
import { Checkbox } from "@repo/ui/shadcn/checkbox";
import { Label } from "@repo/ui/shadcn/label";
import { useState } from "react";
import { getAppErrorMessage } from "@/lib/user-facing-error";
import { type KcbDemoStatus, useKcbIdentityVerification } from "../hooks";
import { toIdentityLocale } from "../lib/locale";

function toGateStatus(status: KcbDemoStatus): "ready" | "pending" | "failed" {
  if (status === "idle") return "ready";
  if (status === "pending") return "pending";
  return "failed";
}

export function IdentityVerificationDemoPage() {
  const { t, i18n } = useFeatureTranslation("feature.identityVerification");
  const { t: appT } = useFeatureTranslation("app");
  const locale = toIdentityLocale(i18n.language);
  const [agreed, setAgreed] = useState(false);

  const { status, blockerCode, start, reset, isStarting, startError } =
    useKcbIdentityVerification();

  const isResult =
    status === "verified" || status === "failed" || status === "canceled" || status === "expired";
  const gateStatus = toGateStatus(status);

  function handleRetry() {
    reset();
    setAgreed(false);
  }

  return (
    <div className="container mx-auto max-w-xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-xs text-muted-foreground">{t("note")}</p>

          <div className="flex items-start gap-2">
            <Checkbox
              id="kcb-consent"
              checked={agreed}
              onCheckedChange={(value) => setAgreed(value === true)}
            />
            <Label htmlFor="kcb-consent" className="text-sm leading-snug">
              {t("consentLabel")}
            </Label>
          </div>

          {isResult ? (
            <KcbReturnPanel
              status={status}
              locale={locale}
              onRetry={handleRetry}
              onContinue={reset}
            />
          ) : (
            <KcbIdentityGate
              status={gateStatus}
              blockerCode={blockerCode}
              locale={locale}
              disabled={!agreed || isStarting}
              onStart={() => {
                void start();
              }}
            />
          )}

          {startError ? (
            <p className="text-sm text-destructive">{getAppErrorMessage(appT, startError)}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
