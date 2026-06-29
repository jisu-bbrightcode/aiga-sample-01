import { Badge } from "@repo/ui/shadcn/badge";
import { Card, CardContent, CardHeader } from "@repo/ui/shadcn/card";
import { Receipt } from "lucide-react";
import { useMyInvoices } from "../hooks/use-invoices";

interface InvoiceRow {
  id: string;
  polarOrderId: string;
  amountCents: number;
  currency: string;
  status: "paid" | "refunded" | "partially_refunded" | "failed";
  invoiceUrl: string | null;
  createdAt: string | Date;
}

const STATUS_LABEL: Record<InvoiceRow["status"], string> = {
  paid: "결제 완료",
  refunded: "환불됨",
  partially_refunded: "부분 환불",
  failed: "실패",
};

const STATUS_VARIANT: Record<
  InvoiceRow["status"],
  "default" | "secondary" | "outline" | "destructive"
> = {
  paid: "default",
  refunded: "outline",
  partially_refunded: "outline",
  failed: "destructive",
};

function formatCurrency(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

export function InvoicesPage() {
  const { data, isLoading } = useMyInvoices({ limit: 50 });
  const rows = (data?.rows ?? []) as InvoiceRow[];

  return (
    <div className="container mx-auto max-w-3xl space-y-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold">인보이스</h1>
        <p className="mt-1 text-sm text-muted-foreground">결제 내역과 영수증을 확인하세요.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <span className="text-base font-semibold">최근 결제</span>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between py-2">
                  <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Receipt className="mb-3 size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">아직 결제 내역이 없습니다.</p>
            </div>
          ) : (
            <ul className="divide-y">
              {rows.map((order) => (
                <li key={order.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      Order {order.polarOrderId.slice(0, 12)}…
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(order.createdAt).toLocaleDateString("ko-KR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={STATUS_VARIANT[order.status]}>
                      {STATUS_LABEL[order.status]}
                    </Badge>
                    <span className="w-20 text-right text-sm font-medium tabular-nums">
                      {formatCurrency(order.amountCents, order.currency)}
                    </span>
                    {order.invoiceUrl ? (
                      <a
                        href={order.invoiceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        PDF
                      </a>
                    ) : (
                      <span className="w-8 text-center text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
