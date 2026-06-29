/**
 * @design-ref none — reusable return-state component; no finalized screen HTML exists.
 */
import { Badge } from "@repo/ui/shadcn/badge";
import { Button } from "@repo/ui/shadcn/button";
import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { getIdentityVerificationMessage, type IdentityVerificationLocale } from "./messages";

export interface KcbReturnPanelProps {
  status: "pending" | "verified" | "failed" | "canceled" | "expired";
  locale?: IdentityVerificationLocale;
  onRetry?: () => void;
  onContinue?: () => void;
}

export function KcbReturnPanel({
  status,
  locale = "ko",
  onRetry,
  onContinue,
}: KcbReturnPanelProps) {
  const success = status === "verified";
  const Icon = success ? CheckCircle2 : XCircle;
  return (
    <section className="flex flex-col gap-4 rounded-lg border bg-background p-5">
      <div className="flex items-center gap-3">
        <Icon className={success ? "size-5 text-green-600" : "size-5 text-destructive"} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">
            {getIdentityVerificationMessage(status, locale)}
          </div>
          <Badge variant={success ? "success" : "outline"}>{status}</Badge>
        </div>
      </div>
      {success ? (
        <Button type="button" size="sm" onClick={onContinue}>
          {getIdentityVerificationMessage("verified", locale)}
        </Button>
      ) : (
        <Button type="button" size="sm" variant="outline" onClick={onRetry}>
          <RotateCcw />
          {getIdentityVerificationMessage("start", locale)}
        </Button>
      )}
    </section>
  );
}
