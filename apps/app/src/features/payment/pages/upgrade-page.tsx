import { useFeatureTranslation } from "@repo/core/i18n";
import { Button } from "@repo/ui/shadcn/button";
import { useState } from "react";
import { AppQuietLoadingState } from "@/components/app-loading";
import { getAppErrorMessage } from "@/lib/user-facing-error";
import { ChangePlanDialog } from "../components/change-plan-dialog";
import { CouponInput } from "../components/coupon-input";
import { PlanCard } from "../components/plan-card";
import { buildCheckoutReturnUrls, useCreateSubscriptionCheckout } from "../hooks/use-checkout";
import { useMySubscription } from "../hooks/use-my-subscription";
import { usePlans } from "../hooks/use-plans";

type Cycle = "monthly" | "yearly";

interface PlanRow {
  id: string;
  slug: string;
  name: string;
  cycle: "lifetime" | "monthly" | "yearly";
  priceCents: number;
  currency: string;
  includedCreditsPerCycle: number;
  seats: number;
  trialDays: number;
  polarProductId: string | null;
}

interface PendingTarget {
  id: string;
  name: string;
}

type TFn = (key: string, options?: Record<string, unknown>) => string;

function getPlanCtaLabel(input: {
  plan: PlanRow;
  isCurrent: boolean;
  isPending: boolean;
  hasActiveSub: boolean;
  t: TFn;
}) {
  const { plan, isCurrent, isPending, hasActiveSub, t } = input;
  if (plan.priceCents === 0) return t("payment.upgrade.cta.free");
  if (isCurrent) return t("payment.upgrade.cta.current");
  if (isPending) return t("payment.action.processing");
  return hasActiveSub
    ? t("payment.upgrade.cta.change", { plan: plan.name })
    : t("payment.upgrade.cta.start", { plan: plan.name });
}

export function UpgradePage() {
  const { t } = useFeatureTranslation("app");
  const plans = usePlans();
  const sub = useMySubscription();
  const checkout = useCreateSubscriptionCheckout();

  const [cycle, setCycle] = useState<Cycle>("monthly");
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [pendingTarget, setPendingTarget] = useState<PendingTarget | null>(null);

  const allPlans = (plans.data ?? []) as PlanRow[];
  // Free plan + plans for the chosen cycle.
  const visible = allPlans.filter((p) => p.cycle === "lifetime" || p.cycle === cycle);

  const activeSub = sub.data;
  const hasActiveSub = Boolean(
    activeSub && (activeSub.status === "active" || activeSub.status === "trialing"),
  );

  function handleSelectPlan(plan: PlanRow) {
    if (plan.priceCents === 0) return; // free plan, no checkout
    if (!plan.polarProductId) return;

    // 활성 구독이 있고 같은 플랜이면 no-op
    if (hasActiveSub && activeSub?.planId === plan.id) return;

    if (hasActiveSub) {
      // 플랜 변경 Dialog
      setPendingTarget({ id: plan.id, name: plan.name });
      return;
    }

    // 신규 구독 checkout
    const { successUrl } = buildCheckoutReturnUrls();
    checkout.mutate(
      {
        planId: plan.id,
        billingCycle: plan.cycle === "lifetime" ? cycle : (plan.cycle as Cycle),
        successUrl,
        couponCode: couponCode ?? undefined,
      },
      {
        onSuccess: (result) => {
          if (result?.checkoutUrl) {
            window.location.href = result.checkoutUrl;
          }
        },
      },
    );
  }

  return (
    <div className="container mx-auto max-w-5xl space-y-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold">{t("payment.upgrade.title")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t("payment.upgrade.description")}</p>
      </div>

      <div className="flex items-center justify-center gap-2">
        <Button
          variant={cycle === "monthly" ? "default" : "outline"}
          size="sm"
          onClick={() => setCycle("monthly")}
        >
          {t("payment.upgrade.cycleMonthly")}
        </Button>
        <Button
          variant={cycle === "yearly" ? "default" : "outline"}
          size="sm"
          onClick={() => setCycle("yearly")}
        >
          {t("payment.upgrade.cycleYearly")}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {plans.isLoading ? (
          <AppQuietLoadingState
            className="col-span-full"
            label={t("payment.upgrade.loadingPlans")}
            variant="inline"
          />
        ) : (
          visible.map((plan) => {
            const isCurrent = activeSub?.planId === plan.id;
            const isPro = /pro/i.test(plan.slug);
            return (
              <PlanCard
                key={plan.id}
                name={plan.name}
                priceCents={plan.priceCents}
                currency={plan.currency}
                cycle={plan.cycle}
                includedCreditsPerCycle={plan.includedCreditsPerCycle}
                seats={plan.seats}
                trialDays={plan.trialDays}
                highlight={isPro && !isCurrent}
                currentPlan={isCurrent}
                ctaLabel={getPlanCtaLabel({
                  plan,
                  isCurrent,
                  isPending: checkout.isPending,
                  hasActiveSub,
                  t,
                })}
                ctaDisabled={
                  isCurrent || plan.priceCents === 0 || checkout.isPending || !plan.polarProductId
                }
                onCta={() => handleSelectPlan(plan)}
              />
            );
          })
        )}
      </div>

      {!hasActiveSub && (
        <div className="border-t pt-4">
          <p className="mb-2 text-sm font-medium">{t("payment.coupon.label")}</p>
          <CouponInput scope="subscription" onCouponChange={setCouponCode} />
        </div>
      )}

      {checkout.error && (
        <p className="text-destructive text-sm">
          {getAppErrorMessage(t, checkout.error, "errors.paymentCheckout")}
        </p>
      )}

      <ChangePlanDialog
        open={!!pendingTarget}
        onOpenChange={(open) => {
          if (!open) setPendingTarget(null);
        }}
        targetPlanId={pendingTarget?.id ?? null}
        targetPlanName={pendingTarget?.name ?? ""}
        currency={allPlans.find((p) => p.id === pendingTarget?.id)?.currency ?? "USD"}
      />
    </div>
  );
}
