import { PageHeader } from "@repo/ui/components/page-header";
import { Badge } from "@repo/ui/shadcn/badge";
import { Button } from "@repo/ui/shadcn/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/shadcn/card";
import { Skeleton } from "@repo/ui/shadcn/skeleton";
import { useParams } from "@tanstack/react-router";
import { RefreshCcw } from "lucide-react";
import { useState } from "react";
import { RefundDialog } from "../components/refund-dialog";
import { useOrderDetail } from "../hooks/use-order-detail";

export function OrderDetailPage() {
  const { orderId } = useParams({ strict: false }) as { orderId: string };
  const { data, isLoading } = useOrderDetail(orderId);
  const [refundOpen, setRefundOpen] = useState(false);

  if (isLoading || !data) {
    return (
      <div className="container mx-auto py-8">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const { order } = data;
  const refundable = order.status === "paid" || order.status === "partially_refunded";

  return (
    <div className="container mx-auto space-y-6 py-8">
      <PageHeader
        title={`주문 ${order.id.slice(0, 8)}`}
        description={`Polar Order ${order.polarOrderId}`}
        actions={
          <Button variant="destructive" disabled={!refundable} onClick={() => setRefundOpen(true)}>
            <RefreshCcw className="mr-1 size-3.5" />
            환불 처리
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>주문 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="organization" mono>
            {order.organizationId}
          </Row>
          <Row label="user" mono>
            {order.userId}
          </Row>
          <Row label="금액">
            ${(order.amountCents / 100).toLocaleString()} {order.currency}
          </Row>
          <Row label="환불됨">
            ${(order.refundedAmountCents / 100).toLocaleString()} {order.currency}
          </Row>
          <Row label="상태">
            <Badge>{order.status}</Badge>
          </Row>
          <Row label="구독 ID" mono>
            {order.subscriptionId ?? "—"}
          </Row>
          <Row label="패키지 ID" mono>
            {order.packageId ?? "—"}
          </Row>
          <Row label="생성일">{new Date(order.createdAt).toLocaleString("ko-KR")}</Row>
          <Row label="Invoice">
            {order.invoiceUrl ? (
              <a
                className="text-primary underline"
                href={order.invoiceUrl}
                target="_blank"
                rel="noreferrer"
              >
                보기
              </a>
            ) : (
              "—"
            )}
          </Row>
        </CardContent>
      </Card>

      <RefundDialog orderId={order.id} open={refundOpen} onOpenChange={setRefundOpen} />
    </div>
  );
}

function Row({
  label,
  mono,
  children,
}: {
  label: string;
  mono?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-xs" : ""}>{children}</span>
    </div>
  );
}
