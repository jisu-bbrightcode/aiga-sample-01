import { buttonVariants } from "@repo/ui/shadcn/button";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearch } from "@tanstack/react-router";
import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import { apiClient } from "@/lib/api";
import { BILLING_PATH, PAYMENT_PRICING_PATH } from "../index";

interface InicisOrderResponse {
  order?: {
    status?: string | null;
    orderId?: string | null;
    amount?: number | null;
    currency?: string | null;
  };
}

const resultText: Record<string, { title: string; description: string }> = {
  success: {
    title: "결제 요청이 완료되었습니다",
    description: "결제 반영까지 잠시 시간이 걸릴 수 있습니다.",
  },
  failed: {
    title: "결제를 완료하지 못했습니다",
    description: "청구가 확정되지 않았습니다. 잠시 후 다시 시도해 주세요.",
  },
  pending: {
    title: "결제 확인 중입니다",
    description: "입금 또는 승인 결과를 확인하고 있습니다.",
  },
};

const failureText: Record<string, string> = {
  auth_failed: "인증이 완료되지 않았습니다.",
  approval_failed: "승인 처리 중 문제가 생겼습니다.",
  approval_rejected: "결제 승인이 거절되었습니다.",
  inicis_order_not_found: "주문 정보를 확인하지 못했습니다.",
  inicis_auth_mid_mismatch: "결제 요청 정보를 확인하지 못했습니다.",
  inicis_auth_oid_mismatch: "결제 요청 정보를 확인하지 못했습니다.",
  inicis_approval_moid_mismatch: "결제 요청 정보를 확인하지 못했습니다.",
  inicis_approval_amount_mismatch: "결제 금액을 확인하지 못했습니다.",
  inicis_approval_mid_mismatch: "결제 요청 정보를 확인하지 못했습니다.",
};

export function PaymentResultPage() {
  const search = useSearch({ strict: false }) as {
    status?: string;
    code?: string;
    orderId?: string;
  };
  const status = normalizeStatus(search.status);
  const copy = resultText[status];
  const orderId = typeof search.orderId === "string" ? search.orderId : "";
  const orderQuery = useQuery({
    queryKey: ["payment", "inicis-order", orderId],
    enabled: orderId.length > 0,
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/payment/orders/{orderId}", {
        params: { path: { orderId } },
      });
      if (error) throw error;
      return data as InicisOrderResponse;
    },
    retry: false,
  });
  const Icon = resultIcon(status);
  const tone = resultTone(status);
  const statusLabel = orderStatusLabel(orderQuery.data?.order?.status);
  const detail = status === "failed" ? failureText[search.code ?? ""] : undefined;

  return (
    <div className="container mx-auto max-w-md py-20">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className={`flex size-16 items-center justify-center rounded-full ${tone}`}>
          <Icon className="size-10" />
        </div>
        <h1 className="text-2xl font-semibold">{copy.title}</h1>
        <p className="text-sm text-muted-foreground">{detail ?? copy.description}</p>
        {statusLabel ? (
          <p className="text-xs text-muted-foreground">현재 주문 상태: {statusLabel}</p>
        ) : null}
        <div className="flex gap-2">
          <Link to={BILLING_PATH} className={buttonVariants()}>
            결제 내역 보기
          </Link>
          {status === "failed" ? (
            <Link to={PAYMENT_PRICING_PATH} className={buttonVariants({ variant: "outline" })}>
              다시 시도
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function normalizeStatus(status: string | undefined): "success" | "failed" | "pending" {
  if (status === "success" || status === "failed") return status;
  return "pending";
}

function resultIcon(status: "success" | "failed" | "pending") {
  if (status === "success") return CheckCircle2;
  if (status === "pending") return Clock3;
  return XCircle;
}

function resultTone(status: "success" | "failed" | "pending"): string {
  if (status === "success") return "bg-emerald-500/10 text-emerald-600";
  if (status === "pending") return "bg-amber-500/10 text-amber-600";
  return "bg-muted text-muted-foreground";
}

function orderStatusLabel(status: string | null | undefined): string | null {
  switch (status) {
    case "approved":
    case "paid":
      return "결제 완료";
    case "pending_auth":
      return "결제 대기";
    case "auth_failed":
    case "failed":
      return "결제 실패";
    case "partially_refunded":
      return "부분 환불";
    case "refunded":
    case "canceled":
      return "환불 완료";
    default:
      return null;
  }
}
