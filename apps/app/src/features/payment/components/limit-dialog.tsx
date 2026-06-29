import { useFeatureTranslation } from "@repo/core/i18n";
import { Button } from "@repo/ui/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/shadcn/dialog";
import { Input } from "@repo/ui/shadcn/input";
import { Label } from "@repo/ui/shadcn/label";
import { Switch } from "@repo/ui/shadcn/switch";
import { useEffect, useState } from "react";
import { getAppErrorMessage } from "@/lib/user-facing-error";
import { useUpdateExtraUsageSettings } from "../hooks/use-extra-usage";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  settings: {
    monthlyLimitCents: number;
    autoRechargeEnabled: boolean;
    autoRechargeThresholdCents: number;
    autoRechargePackageId: string | null;
  };
}

export function LimitDialog({ open, onOpenChange, settings }: Props) {
  const { t } = useFeatureTranslation("app");
  const update = useUpdateExtraUsageSettings();
  const [limitDollars, setLimitDollars] = useState((settings.monthlyLimitCents / 100).toFixed(2));
  const [autoRechargeEnabled, setAutoRechargeEnabled] = useState(settings.autoRechargeEnabled);
  const [thresholdDollars, setThresholdDollars] = useState(
    (settings.autoRechargeThresholdCents / 100).toFixed(2),
  );

  // open=true 시 현재 settings 값으로 초기화 (PR #62 Phase 2 fix I1 패턴)
  useEffect(() => {
    if (open) {
      setLimitDollars((settings.monthlyLimitCents / 100).toFixed(2));
      setAutoRechargeEnabled(settings.autoRechargeEnabled);
      setThresholdDollars((settings.autoRechargeThresholdCents / 100).toFixed(2));
    }
  }, [
    open,
    settings.monthlyLimitCents,
    settings.autoRechargeEnabled,
    settings.autoRechargeThresholdCents,
  ]);

  // Fix C2: autoRecharge 켜져 있지만 package 미선택 시 저장 차단
  const autoRechargeBlocked = autoRechargeEnabled && !settings.autoRechargePackageId;

  const handleSave = () => {
    const monthlyLimitCents = Math.round(parseFloat(limitDollars) * 100);
    const thresholdCents = Math.round(parseFloat(thresholdDollars) * 100);
    update.mutate(
      {
        monthlyLimitCents,
        autoRechargeEnabled,
        autoRechargeThresholdCents: thresholdCents,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("payment.limit.title")}</DialogTitle>
          <DialogDescription>{t("payment.limit.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="limit">{t("payment.limit.monthlyLimitLabel")}</Label>
            <Input
              id="limit"
              type="number"
              step="1"
              min="0"
              value={limitDollars}
              onChange={(e) => setLimitDollars(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="auto-recharge">{t("payment.limit.autoRechargeLabel")}</Label>
            <Switch
              id="auto-recharge"
              checked={autoRechargeEnabled}
              onCheckedChange={setAutoRechargeEnabled}
            />
          </div>

          {autoRechargeEnabled && (
            <div className="space-y-2">
              <Label htmlFor="threshold">{t("payment.limit.thresholdLabel")}</Label>
              <Input
                id="threshold"
                type="number"
                step="0.5"
                min="0"
                value={thresholdDollars}
                onChange={(e) => setThresholdDollars(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t("payment.limit.thresholdHint")}</p>
            </div>
          )}

          {autoRechargeBlocked && (
            <p className="text-sm text-amber-600">{t("payment.limit.blocked")}</p>
          )}

          {update.error && (
            <p className="text-sm text-destructive">
              {getAppErrorMessage(t, update.error, "errors.paymentAction")}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={update.isPending}>
            {t("payment.action.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={update.isPending || autoRechargeBlocked}>
            {update.isPending ? t("payment.action.saving") : t("payment.action.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
