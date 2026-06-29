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
import { AppQuietLoadingState } from "@/components/app-loading";
import { getAppErrorMessage } from "@/lib/user-facing-error";
import { useChangePlan, usePreviewPlanChange } from "../hooks/use-plan-change";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  targetPlanId: string | null;
  targetPlanName: string;
  currency: string;
}

type TFn = (key: string, options?: Record<string, unknown>) => string;

function formatCents(cents: number, currency: string): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  if (currency === "KRW") return `${sign}₩${(abs / 100).toLocaleString("ko-KR")}`;
  return `${sign}$${(abs / 100).toFixed(2)}`;
}

function formatDate(value: string | Date, language: string): string {
  return new Date(value).toLocaleDateString(language);
}

function buildChangePlanSubtitle(input: {
  data: NonNullable<ReturnType<typeof usePreviewPlanChange>["data"]>;
  targetPlanName: string;
  currency: string;
  language: string;
  t: TFn;
}) {
  const { data, targetPlanName, currency, language, t } = input;
  if (data.kind === "downgrade") {
    return t("payment.changePlan.description.downgrade", {
      date: formatDate(data.nextChargeAt, language),
      plan: targetPlanName,
    });
  }
  if (data.kind === "cycle-down") {
    return t("payment.changePlan.description.cycleDown", {
      amount: formatCents(-data.prorationCents, currency),
      plan: targetPlanName,
    });
  }
  if (data.kind === "cycle-up") {
    return t("payment.changePlan.description.cycleUp", {
      amount: formatCents(data.prorationCents, currency),
      date: formatDate(data.nextChargeAt, language),
      plan: targetPlanName,
    });
  }
  return t("payment.changePlan.description.immediate", {
    amount: formatCents(data.prorationCents, currency),
  });
}

export function ChangePlanDialog({
  open,
  onOpenChange,
  targetPlanId,
  targetPlanName,
  currency,
}: Props) {
  const { t } = useFeatureTranslation("app");
  const [language] = useLanguage();
  const preview = usePreviewPlanChange(targetPlanId);
  const change = useChangePlan();

  function handleConfirm() {
    if (!targetPlanId) return;
    change.mutate({ targetPlanId }, { onSuccess: () => onOpenChange(false) });
  }

  const data = preview.data;
  const subtitle = data
    ? buildChangePlanSubtitle({ data, targetPlanName, currency, language, t })
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("payment.changePlan.title")}</DialogTitle>
          <DialogDescription>
            {preview.isLoading ? t("payment.changePlan.loadingDescription") : subtitle}
          </DialogDescription>
        </DialogHeader>
        {preview.isLoading ? (
          <AppQuietLoadingState label={t("payment.changePlan.loadingLabel")} variant="inline" />
        ) : null}
        {change.error && (
          <p className="text-destructive text-sm">
            {getAppErrorMessage(t, change.error, "errors.paymentAction")}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={change.isPending}>
            {t("payment.action.cancel")}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={preview.isLoading || change.isPending || !preview.data}
          >
            {change.isPending ? t("payment.action.processing") : t("payment.action.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
