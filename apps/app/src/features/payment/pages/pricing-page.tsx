import { Button, buttonVariants } from "@repo/ui/shadcn/button";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppQuietLoadingState } from "@/components/app-loading";
import { PlanCard } from "../components/plan-card";
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
}

export function PricingPage() {
  const plans = usePlans();
  const [cycle, setCycle] = useState<Cycle>("monthly");

  const list = (plans.data ?? []) as PlanRow[];
  const visible = list.filter((p) => p.cycle === "lifetime" || p.cycle === cycle);
  const signInHref = `/sign-in?redirect=${encodeURIComponent("/billing/upgrade")}`;

  return (
    <div className="container mx-auto max-w-5xl space-y-8 py-12">
      <div className="text-center">
        <h1 className="text-3xl font-bold">요금제</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          시작은 무료. 필요할 때 업그레이드하세요.
        </p>
      </div>

      <div className="flex items-center justify-center gap-2">
        <Button
          variant={cycle === "monthly" ? "default" : "outline"}
          size="sm"
          onClick={() => setCycle("monthly")}
        >
          월간
        </Button>
        <Button
          variant={cycle === "yearly" ? "default" : "outline"}
          size="sm"
          onClick={() => setCycle("yearly")}
        >
          연간 (2개월 할인)
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {plans.isLoading ? (
          <AppQuietLoadingState
            className="col-span-full"
            label="플랜을 불러오는 중..."
            variant="inline"
          />
        ) : (
          visible.map((plan) => {
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
                highlight={isPro}
                ctaLabel={plan.priceCents === 0 ? "무료로 시작" : "회원가입 후 구독"}
              />
            );
          })
        )}
      </div>

      <div className="text-center">
        <Link to={signInHref} className={buttonVariants({ size: "lg" })}>
          로그인하고 시작하기
        </Link>
      </div>
    </div>
  );
}
