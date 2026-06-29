import { useFeatureTranslation, useLanguage } from "@repo/core/i18n";
import { buttonVariants } from "@repo/ui/shadcn/button";
import { Card, CardContent } from "@repo/ui/shadcn/card";
import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { BILLING_TOPUP_PATH } from "../index";

interface CreditBalanceProps {
  balance: number | null | undefined;
  isLoading?: boolean;
  showTopUpAction?: boolean;
}

export function CreditBalance({ balance, isLoading, showTopUpAction = true }: CreditBalanceProps) {
  const { t } = useFeatureTranslation("app");
  const [language] = useLanguage();

  return (
    <Card>
      <CardContent className="flex items-center justify-between py-5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="size-5 text-primary" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("payment.creditBalance.title")}
            </p>
            {isLoading ? (
              <div className="mt-1 h-7 w-24 animate-pulse rounded bg-muted" />
            ) : (
              <p className="text-2xl font-semibold tabular-nums">
                {(balance ?? 0).toLocaleString(language)}
              </p>
            )}
          </div>
        </div>
        {showTopUpAction && (
          <Link
            to={BILLING_TOPUP_PATH}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {t("payment.creditBalance.topUp")}
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
