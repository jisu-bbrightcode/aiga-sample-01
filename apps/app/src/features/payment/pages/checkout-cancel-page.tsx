import { buttonVariants } from "@repo/ui/shadcn/button";
import { Link } from "@tanstack/react-router";
import { XCircle } from "lucide-react";
import { PAYMENT_PRICING_PATH } from "../index";

export function CheckoutCancelPage() {
  return (
    <div className="container mx-auto max-w-md py-20">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-muted">
          <XCircle className="size-10 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-semibold">결제가 취소되었습니다</h1>
        <p className="text-sm text-muted-foreground">
          아무런 청구도 발생하지 않았습니다. 언제든 다시 시도할 수 있어요.
        </p>
        <Link to={PAYMENT_PRICING_PATH} className={buttonVariants({ variant: "outline" })}>
          요금제로 돌아가기
        </Link>
      </div>
    </div>
  );
}
