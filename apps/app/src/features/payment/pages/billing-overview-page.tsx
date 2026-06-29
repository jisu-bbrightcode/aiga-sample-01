import { buttonVariants } from "@repo/ui/shadcn/button";
import { Link } from "@tanstack/react-router";
import { CreditBalance } from "../components/credit-balance";
import { SubscriptionCard } from "../components/subscription-card";
import { UsageMeter } from "../components/usage-meter";
import { useCreditBalance } from "../hooks/use-credits";
import { useMySubscription } from "../hooks/use-my-subscription";
import { useUsageStats } from "../hooks/use-usage";
import {
  BILLING_INVOICES_PATH,
  BILLING_SUBSCRIPTION_PATH,
  BILLING_UPGRADE_PATH,
  BILLING_USAGE_PATH,
} from "../index";

export function BillingOverviewPage() {
  const sub = useMySubscription();
  const balance = useCreditBalance();
  const usage = useUsageStats(30);

  const usageRows = usage.data?.byModel
    ? Object.entries(usage.data.byModel).map(([model, v]) => ({
        model,
        credits: v.credits,
        calls: v.calls,
      }))
    : [];

  return (
    <div className="container mx-auto max-w-5xl space-y-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">내 결제</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            구독 상태, 크레딧 잔액, 사용량을 한눈에 확인하세요.
          </p>
        </div>
        <Link to={BILLING_UPGRADE_PATH} className={buttonVariants()}>
          플랜 업그레이드
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SubscriptionCard subscription={sub.data ?? null} isLoading={sub.isLoading} />
        <CreditBalance balance={balance.data?.balance} isLoading={balance.isLoading} />
      </div>

      <UsageMeter rows={usageRows} isLoading={usage.isLoading} rangeDays={30} />

      <div className="flex flex-wrap gap-2">
        <Link
          to={BILLING_SUBSCRIPTION_PATH}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          구독 관리
        </Link>
        <Link
          to={BILLING_INVOICES_PATH}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          인보이스
        </Link>
        <Link
          to={BILLING_USAGE_PATH}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          사용량 상세
        </Link>
      </div>
    </div>
  );
}
