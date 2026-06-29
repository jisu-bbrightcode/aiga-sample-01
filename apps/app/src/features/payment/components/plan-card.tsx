import { useFeatureTranslation, useLanguage } from "@repo/core/i18n";
import { Badge } from "@repo/ui/shadcn/badge";
import { Button } from "@repo/ui/shadcn/button";
import { Card, CardContent, CardHeader } from "@repo/ui/shadcn/card";
import { Check } from "lucide-react";

interface PlanCardProps {
  name: string;
  priceCents: number;
  currency: string;
  cycle: "lifetime" | "monthly" | "yearly";
  includedCreditsPerCycle: number;
  seats: number;
  trialDays: number;
  highlight?: boolean;
  currentPlan?: boolean;
  ctaLabel: string;
  ctaDisabled?: boolean;
  onCta?: () => void;
}

type TFn = (key: string, options?: Record<string, unknown>) => string;

function formatPrice(cents: number, currency: string, language: string, t: TFn): string {
  if (cents === 0) return t("payment.plan.freePrice");
  return new Intl.NumberFormat(language, {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

const CYCLE_SUFFIX_KEY: Record<PlanCardProps["cycle"], string | null> = {
  lifetime: null,
  monthly: "payment.plan.cycle.monthly",
  yearly: "payment.plan.cycle.yearly",
};

export function PlanCard({
  name,
  priceCents,
  currency,
  cycle,
  includedCreditsPerCycle,
  seats,
  trialDays,
  highlight,
  currentPlan,
  ctaLabel,
  ctaDisabled,
  onCta,
}: PlanCardProps) {
  const { t } = useFeatureTranslation("app");
  const [language] = useLanguage();
  const cycleSuffixKey = CYCLE_SUFFIX_KEY[cycle];

  return (
    <Card className={highlight ? "border-primary shadow-md" : undefined}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold">{name}</span>
          {currentPlan && <Badge variant="secondary">{t("payment.plan.currentBadge")}</Badge>}
          {!currentPlan && highlight && <Badge>{t("payment.plan.recommendedBadge")}</Badge>}
        </div>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-3xl font-bold tabular-nums">
            {formatPrice(priceCents, currency, language, t)}
          </span>
          {priceCents > 0 && cycleSuffixKey && (
            <span className="text-sm text-muted-foreground">{t(cycleSuffixKey)}</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <span>
              {t("payment.plan.creditsPerCycle", {
                credits: includedCreditsPerCycle.toLocaleString(language),
              })}
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <span>{t("payment.plan.seats", { count: seats })}</span>
          </li>
          {trialDays > 0 && (
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
              <span>{t("payment.plan.trialDays", { count: trialDays })}</span>
            </li>
          )}
        </ul>
        <Button
          className="w-full"
          variant={highlight ? "default" : "outline"}
          disabled={ctaDisabled}
          onClick={onCta}
        >
          {ctaLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
