import { useFeatureTranslation } from "@repo/core/i18n";
import { Button } from "@repo/ui/shadcn/button";
import { Input } from "@repo/ui/shadcn/input";
import { useState } from "react";
import { previewCoupon } from "../api/payment";

type Scope = "subscription" | "top_up";

interface CouponInputProps {
  scope: Scope;
  /** Called whenever the validated coupon code changes (or is cleared). */
  onCouponChange?: (code: string | null) => void;
}

interface PreviewResult {
  valid: boolean;
  reason?: string;
  invalidMessageKey?: string;
  type?: string;
  amountOffCents?: number;
  percentOff?: number;
}

export function CouponInput({ scope, onCouponChange }: CouponInputProps) {
  const { t } = useFeatureTranslation("app");

  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [pending, setPending] = useState(false);

  async function handleApply() {
    const trimmed = code.trim();
    if (!trimmed) return;
    setPending(true);
    try {
      const result = await previewCoupon({
        code: trimmed,
        scope,
      });
      setPreview(result);
      onCouponChange?.(result.valid ? trimmed : null);
    } catch {
      setPreview({ valid: false, invalidMessageKey: "errors.couponLookup" });
      onCouponChange?.(null);
    } finally {
      setPending(false);
    }
  }

  function formatDiscount(p: PreviewResult): string {
    if (p.percentOff != null) {
      return t("payment.coupon.percentDiscount", { percent: p.percentOff });
    }
    if (p.amountOffCents != null) {
      return t("payment.coupon.amountDiscount", {
        amount: `$${(p.amountOffCents / 100).toFixed(2)}`,
      });
    }
    return t("payment.coupon.applied");
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={t("payment.coupon.placeholder")}
          className="max-w-xs"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleApply}
          disabled={pending || code.trim().length === 0}
        >
          {pending ? t("payment.coupon.checking") : t("payment.coupon.apply")}
        </Button>
      </div>
      {preview && (
        <p className={preview.valid ? "text-xs text-emerald-600" : "text-xs text-destructive"}>
          {preview.valid
            ? formatDiscount(preview)
            : t(preview.invalidMessageKey ?? "errors.couponInvalid")}
        </p>
      )}
    </div>
  );
}
