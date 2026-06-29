import { useFeatureTranslation, useLanguage } from "@repo/core/i18n";
import { Badge } from "@repo/ui/shadcn/badge";
import { Card, CardContent, CardHeader } from "@repo/ui/shadcn/card";

interface Subscription {
  status: "trialing" | "active" | "past_due" | "grace" | "canceled";
  currentPeriodEnd: string | Date;
  cancelAtPeriodEnd: boolean;
  graceEndsAt?: string | Date | null;
}

interface SubscriptionCardProps {
  subscription: Subscription | null | undefined;
  planName?: string | null;
  isLoading?: boolean;
}

const STATUS_LABEL_KEYS: Record<Subscription["status"], string> = {
  trialing: "payment.subscription.status.trialing",
  active: "payment.subscription.status.active",
  past_due: "payment.subscription.status.pastDue",
  grace: "payment.subscription.status.grace",
  canceled: "payment.subscription.status.canceled",
};

const STATUS_VARIANTS: Record<
  Subscription["status"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  trialing: "secondary",
  active: "default",
  past_due: "destructive",
  grace: "outline",
  canceled: "outline",
};

export function SubscriptionCard({ subscription, planName, isLoading }: SubscriptionCardProps) {
  const { t } = useFeatureTranslation("app");
  const [language] = useLanguage();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="h-5 w-40 animate-pulse rounded bg-muted" />
        </CardHeader>
        <CardContent>
          <div className="h-4 w-56 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    );
  }

  if (!subscription) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold">{t("payment.subscription.currentPlan")}</span>
            <Badge variant="secondary">Free</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t("payment.subscription.freeDescription")}
          </p>
        </CardContent>
      </Card>
    );
  }

  const periodEnd = new Date(subscription.currentPeriodEnd).toLocaleDateString(language);
  const graceEnd = subscription.graceEndsAt
    ? new Date(subscription.graceEndsAt).toLocaleDateString(language)
    : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold">{t("payment.subscription.currentPlan")}</span>
          <Badge variant="default">{planName ?? "Pro"}</Badge>
          <Badge variant={STATUS_VARIANTS[subscription.status]}>
            {t(STATUS_LABEL_KEYS[subscription.status])}
          </Badge>
          {subscription.cancelAtPeriodEnd && (
            <Badge variant="outline" className="border-destructive/40 text-destructive">
              {t("payment.subscription.cancelScheduled")}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-1 text-sm text-muted-foreground">
        <p>
          {subscription.cancelAtPeriodEnd
            ? t("payment.subscription.periodEnd")
            : t("payment.subscription.nextBilling")}
          : {periodEnd}
        </p>
        {subscription.status === "grace" && graceEnd && (
          <p className="text-destructive">
            {t("payment.subscription.graceEndsAt", { date: graceEnd })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
