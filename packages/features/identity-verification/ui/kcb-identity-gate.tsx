/**
 * @design-ref none — reusable capability component; no finalized screen HTML exists.
 */
import { Badge } from "@repo/ui/shadcn/badge";
import { Button } from "@repo/ui/shadcn/button";
import { ShieldCheck } from "lucide-react";
import { getIdentityVerificationMessage, type IdentityVerificationLocale } from "./messages";

export interface KcbIdentityGateProps {
  status?: "ready" | "pending" | "verified" | "failed" | "canceled" | "expired";
  blockerCode?: string | null;
  locale?: IdentityVerificationLocale;
  disabled?: boolean;
  onStart: () => void;
}

export function KcbIdentityGate({
  status = "ready",
  blockerCode,
  locale = "ko",
  disabled = false,
  onStart,
}: KcbIdentityGateProps) {
  const variant = resolveStatusBadgeVariant(status);
  const messageKey = blockerCode ?? status;

  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <ShieldCheck className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-medium">
            {getIdentityVerificationMessage(messageKey as never, locale)}
          </span>
        </div>
        <Badge variant={variant}>{status}</Badge>
      </div>
      <Button
        type="button"
        size="sm"
        disabled={disabled || status === "pending" || status === "verified"}
        onClick={onStart}
      >
        <ShieldCheck />
        {getIdentityVerificationMessage("start", locale)}
      </Button>
    </section>
  );
}

function resolveStatusBadgeVariant(status: KcbIdentityGateProps["status"]) {
  if (status === "verified") return "success";
  if (status === "failed") return "destructive";
  return "outline";
}
