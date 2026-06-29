import { PageHeader } from "@repo/ui/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/shadcn/card";
import { Skeleton } from "@repo/ui/shadcn/skeleton";
import { PaymentStatsCards } from "../components/payment-stats-cards";
import { usePaymentDashboard } from "../hooks/use-payment-dashboard";

export function AdminPaymentPage() {
  const { data, isLoading } = usePaymentDashboard();
  const recentEventsContent = (() => {
    if (isLoading) return <Skeleton className="h-32 w-full" />;
    if (!data?.recentEvents?.length) {
      return (
        <p className="py-6 text-center text-sm text-muted-foreground">최근 이벤트가 없습니다.</p>
      );
    }
    return (
      <ul className="space-y-2 text-sm">
        {data.recentEvents.map((evt) => (
          <li
            key={evt.id}
            className="flex items-center justify-between border-b py-2 last:border-b-0"
          >
            <span className="font-mono text-xs text-muted-foreground">
              {evt.subscriptionId ? evt.subscriptionId.slice(0, 8) : "—"}
            </span>
            <span className="font-medium">{evt.eventType}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(evt.receivedAt).toLocaleString("ko-KR")}
            </span>
          </li>
        ))}
      </ul>
    );
  })();

  return (
    <div className="container mx-auto space-y-6 py-8">
      <PageHeader title="결제 대시보드" description="MRR / ARR / 활성 구독 / Churn 스냅샷" />

      <PaymentStatsCards
        isLoading={isLoading}
        stats={
          data
            ? {
                mrrCents: data.mrr,
                arrCents: data.arr,
                activeSubs: data.activeSubs,
                trialingSubs: data.trialingSubs,
                churn30d: data.churn30d,
              }
            : undefined
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>최근 이벤트</CardTitle>
        </CardHeader>
        <CardContent>{recentEventsContent}</CardContent>
      </Card>
    </div>
  );
}
