import { useFeatureTranslation, useLanguage } from "@repo/core/i18n";
import { Button } from "@repo/ui/shadcn/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/shadcn/card";
import { Progress } from "@repo/ui/shadcn/progress";
import { Switch } from "@repo/ui/shadcn/switch";
import { useState } from "react";
import { getAppErrorMessage } from "@/lib/user-facing-error";
import {
  useExtraUsageSettings,
  useUpdateExtraUsageSettings,
  useUsageStats,
} from "../hooks/use-extra-usage";
import { LimitDialog } from "./limit-dialog";

function formatCents(cents: number, currency = "USD"): string {
  if (currency === "KRW") {
    return `₩${(cents / 100).toLocaleString("ko-KR")}`;
  }
  return `US$${(cents / 100).toFixed(2)}`;
}

export function ExtraUsageCard() {
  const { t } = useFeatureTranslation("app");
  const [language] = useLanguage();
  const settings = useExtraUsageSettings();
  const stats = useUsageStats();
  const update = useUpdateExtraUsageSettings();
  const [limitOpen, setLimitOpen] = useState(false);

  if (!settings.data || !stats.data) return null;

  const { enabled, monthlyLimitCents, autoRechargeEnabled } = settings.data;
  const { accumulatedCents, paidBalanceCents, cycleEnd, currency } = stats.data;
  const ratio =
    monthlyLimitCents > 0
      ? Math.min(100, Math.round((accumulatedCents / monthlyLimitCents) * 100))
      : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>{t("payment.extraUsage.title")}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("payment.extraUsage.description")}
          </p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(v) => update.mutate({ enabled: v })}
          disabled={update.isPending}
        />
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 사용량 진행 표시 */}
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <span className="font-medium">
              {t("payment.extraUsage.used", {
                amount: formatCents(accumulatedCents, currency),
              })}
            </span>
            <Progress value={ratio} className="flex-1" />
            <span className="text-xs text-muted-foreground">{ratio}%</span>
          </div>
          {cycleEnd && (
            <p className="text-xs text-muted-foreground">
              {t("payment.extraUsage.resetAt", {
                date: new Date(cycleEnd).toLocaleDateString(language),
              })}
            </p>
          )}
        </div>

        {/* 월간 지출 한도 */}
        <div className="flex items-center justify-between border-t pt-4">
          <div>
            <p className="font-medium">{formatCents(monthlyLimitCents, currency)}</p>
            <p className="text-xs text-muted-foreground">{t("payment.extraUsage.monthlyLimit")}</p>
          </div>
          <Button variant="outline" onClick={() => setLimitOpen(true)}>
            {t("payment.extraUsage.adjustLimit")}
          </Button>
        </div>

        {/* 잔액 + 추가 사용량 구매 */}
        <div className="flex items-center justify-between border-t pt-4">
          <div>
            <p className="font-medium">{formatCents(paidBalanceCents, currency)}</p>
            <p className="text-xs text-muted-foreground">
              {t("payment.extraUsage.balanceStatus", {
                status: autoRechargeEnabled
                  ? t("payment.extraUsage.autoRechargeOn")
                  : t("payment.extraUsage.autoRechargeOff"),
              })}
            </p>
          </div>
          {/* 패키지 선택 UI 는 v1.1 follow-up */}
          <Button disabled>{t("payment.extraUsage.buy")}</Button>
        </div>

        {update.error && (
          <p className="text-sm text-destructive">
            {getAppErrorMessage(t, update.error, "errors.paymentAction")}
          </p>
        )}
      </CardContent>

      <LimitDialog open={limitOpen} onOpenChange={setLimitOpen} settings={settings.data} />
    </Card>
  );
}
