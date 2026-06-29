import { useFeatureTranslation, useLanguage } from "@repo/core/i18n";
import { Button } from "@repo/ui/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/shadcn/dialog";
import { Label } from "@repo/ui/shadcn/label";
import { RadioGroup, RadioGroupItem } from "@repo/ui/shadcn/radio-group";
import { useEffect, useState } from "react";
import { getAppErrorMessage } from "@/lib/user-facing-error";
import { useCancelSubscription } from "../hooks/use-plan-change";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  refundEligible: boolean;
  refundAmountCents: number;
  currency: string;
  cycleEnd: Date;
}

export function CancelDialog({
  open,
  onOpenChange,
  refundEligible,
  refundAmountCents,
  currency,
  cycleEnd,
}: Props) {
  const { t } = useFeatureTranslation("app");
  const [language] = useLanguage();
  const cancel = useCancelSubscription();
  const [mode, setMode] = useState<"at_period_end" | "with_refund">("at_period_end");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) {
      setMode("at_period_end");
      setReason("");
    }
  }, [open]);

  function handleConfirm() {
    cancel.mutate(
      { mode, reason: reason || "user_cancel" },
      { onSuccess: () => onOpenChange(false) },
    );
  }

  const refundLabel =
    currency === "KRW"
      ? `₩${(refundAmountCents / 100).toLocaleString("ko-KR")}`
      : `$${(refundAmountCents / 100).toFixed(2)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("payment.cancel.title")}</DialogTitle>
          <DialogDescription>{t("payment.cancel.description")}</DialogDescription>
        </DialogHeader>
        <RadioGroup value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
          <div className="flex items-start gap-3">
            <RadioGroupItem value="at_period_end" id="opt-period-end" className="mt-1" />
            <div>
              <Label htmlFor="opt-period-end" className="font-medium">
                {t("payment.cancel.option.periodEnd.label")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("payment.cancel.option.periodEnd.description", {
                  date: cycleEnd.toLocaleDateString(language),
                })}
              </p>
            </div>
          </div>
          {refundEligible && (
            <div className="flex items-start gap-3">
              <RadioGroupItem value="with_refund" id="opt-refund" className="mt-1" />
              <div>
                <Label htmlFor="opt-refund" className="font-medium">
                  {t("payment.cancel.option.refund.label", { amount: refundLabel })}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t("payment.cancel.option.refund.description")}
                </p>
              </div>
            </div>
          )}
        </RadioGroup>
        {cancel.error && (
          <p className="text-sm text-destructive">
            {getAppErrorMessage(t, cancel.error, "errors.paymentAction")}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={cancel.isPending}>
            {t("payment.cancel.action.back")}
          </Button>
          <Button onClick={handleConfirm} disabled={cancel.isPending}>
            {cancel.isPending ? t("payment.action.processing") : t("payment.cancel.action.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
