import { buttonVariants } from "@repo/ui/shadcn/button";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { useEffect } from "react";
import { BILLING_PATH } from "../index";

const REDIRECT_DELAY_MS = 4000;

/**
 * Spec §3.1 D — Polar substitutes `{CHECKOUT_ID}` in successUrl server-side.
 * We read it from the query string here and surface it while the `order.paid`
 * webhook processes asynchronously. Treat literal `{CHECKOUT_ID}` (un-substituted)
 * as absent — happens when Polar's substitution fails for any reason.
 */
export function CheckoutSuccessPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as {
    checkout_id?: string;
  };
  const checkoutId =
    search.checkout_id && !search.checkout_id.includes("{")
      ? search.checkout_id
      : undefined;

  useEffect(() => {
    const t = window.setTimeout(() => {
      void navigate({ to: BILLING_PATH });
    }, REDIRECT_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [navigate]);

  return (
    <div className="container mx-auto max-w-md py-20">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-emerald-500/10">
          <CheckCircle2 className="size-10 text-emerald-600" />
        </div>
        <h1 className="text-2xl font-semibold">결제 완료</h1>
        <p className="text-sm text-muted-foreground">
          결제가 정상적으로 처리되었습니다. 잠시 후 결제 페이지로 이동합니다.
        </p>
        {checkoutId && (
          <p className="text-xs text-muted-foreground">
            checkout {checkoutId}
          </p>
        )}
        <Link to={BILLING_PATH} className={buttonVariants()}>
          지금 이동
        </Link>
      </div>
    </div>
  );
}
