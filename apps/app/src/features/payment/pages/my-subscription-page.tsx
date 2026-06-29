import { useFeatureTranslation, useLanguage } from "@repo/core/i18n";
import { Button, buttonVariants } from "@repo/ui/shadcn/button";
import { Card, CardContent, CardHeader } from "@repo/ui/shadcn/card";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { getAppErrorMessage } from "@/lib/user-facing-error";
import { CancelDialog } from "../components/cancel-dialog";
import { ExtraUsageCard } from "../components/extra-usage-card";
import { SubscriptionCard } from "../components/subscription-card";
import { useMySubscription, useReactivateSubscription } from "../hooks/use-my-subscription";
import { useUncancelSubscription } from "../hooks/use-plan-change";
import { usePlans } from "../hooks/use-plans";
import { BILLING_UPGRADE_PATH } from "../index";

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: existing billing state matrix; FLT-394 only masks displayed errors.
export function MySubscriptionPage() {
  const { t } = useFeatureTranslation("app");
  const [language] = useLanguage();
  const sub = useMySubscription();
  const plans = usePlans();
  const reactivate = useReactivateSubscription();
  const uncancel = useUncancelSubscription();

  const [cancelOpen, setCancelOpen] = useState(false);

  const subscription = sub.data ?? null;
  const status = subscription?.status;
  const canCancel =
    subscription &&
    !subscription.cancelAtPeriodEnd &&
    (status === "active" || status === "trialing");
  const canUncancel = subscription?.cancelAtPeriodEnd === true;
  const canReactivate = status === "grace" || status === "past_due";

  // refundEligible: 결제 후 14일 이내 (server 와 동일하게 inclusive: <=)
  const refundEligible = (() => {
    if (!subscription?.currentPeriodStart) return false;
    const start = new Date(subscription.currentPeriodStart as unknown as string);
    return Date.now() <= start.getTime() + 14 * 24 * 60 * 60 * 1000;
  })();

  // UI 표시용 환불 금액 — 서버가 정확한 금액 결정, 여기서는 플랜 priceCents 참조
  const currentPlan = plans.data?.find((p) => p.id === subscription?.planId);
  const refundAmountCents = currentPlan?.priceCents ?? 0;
  const currency = currentPlan?.currency ?? "USD";

  const cycleEnd = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd as unknown as string)
    : new Date();

  function handleReactivate() {
    reactivate.mutate(undefined);
  }

  return (
    <div className="container mx-auto max-w-3xl space-y-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold">{t("payment.mySubscription.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("payment.mySubscription.description")}
        </p>
      </div>

      <SubscriptionCard subscription={subscription} isLoading={sub.isLoading} />

      {subscription && ["trialing", "active", "past_due", "grace"].includes(status ?? "") && (
        <ExtraUsageCard />
      )}

      <Card>
        <CardHeader className="pb-3">
          <span className="text-base font-semibold">{t("payment.mySubscription.manageTitle")}</span>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Link to={BILLING_UPGRADE_PATH} className={buttonVariants()}>
              {t("payment.mySubscription.action.changePlan")}
            </Link>

            {canCancel && (
              <Button variant="outline" onClick={() => setCancelOpen(true)}>
                {t("payment.mySubscription.action.cancel")}
              </Button>
            )}

            {canUncancel && (
              <Button
                variant="outline"
                onClick={() => uncancel.mutate(undefined)}
                disabled={uncancel.isPending}
              >
                {uncancel.isPending
                  ? t("payment.action.processing")
                  : t("payment.mySubscription.action.uncancel")}
              </Button>
            )}

            {canReactivate && (
              <Button variant="default" onClick={handleReactivate} disabled={reactivate.isPending}>
                {reactivate.isPending
                  ? t("payment.action.processing")
                  : t("payment.mySubscription.action.reactivate")}
              </Button>
            )}
          </div>

          {uncancel.error && (
            <p className="text-xs text-destructive">
              {getAppErrorMessage(t, uncancel.error, "errors.paymentAction")}
            </p>
          )}
          {reactivate.error && (
            <p className="text-xs text-destructive">
              {getAppErrorMessage(t, reactivate.error, "errors.paymentAction")}
            </p>
          )}
          {canUncancel && (
            <p className="text-xs text-muted-foreground">
              {t("payment.mySubscription.cancelScheduledHint", {
                date: cycleEnd.toLocaleDateString(language),
              })}
            </p>
          )}
        </CardContent>
      </Card>

      {subscription && (
        <CancelDialog
          open={cancelOpen}
          onOpenChange={setCancelOpen}
          refundEligible={refundEligible}
          refundAmountCents={refundAmountCents}
          currency={currency}
          cycleEnd={cycleEnd}
        />
      )}
    </div>
  );
}
