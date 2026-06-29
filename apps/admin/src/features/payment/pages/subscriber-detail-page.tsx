import { PageHeader } from "@repo/ui/components/page-header";
import { Badge } from "@repo/ui/shadcn/badge";
import { Button } from "@repo/ui/shadcn/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/shadcn/card";
import { Skeleton } from "@repo/ui/shadcn/skeleton";
import { useParams } from "@tanstack/react-router";
import { Coins, MinusCircle, PauseCircle, PlusCircle, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { GrantCreditDialog } from "../components/grant-credit-dialog";
import { useRefundActions } from "../hooks/use-refund-actions";
import { useSubscriberDetail } from "../hooks/use-subscriber-detail";

export function SubscriberDetailPage() {
  const { subscriptionId } = useParams({ strict: false }) as { subscriptionId: string };
  const { data, isLoading } = useSubscriberDetail(subscriptionId);
  const { cancelNow, releaseSuspend } = useRefundActions({ subscriptionId });

  const [creditMode, setCreditMode] = useState<"grant" | "revoke" | null>(null);

  if (isLoading || !data) {
    return (
      <div className="container mx-auto py-8">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const { subscription, events, balance } = data;

  const handleCancelNow = async () => {
    if (!confirm("정말 즉시 취소하시겠습니까? (Polar 동기화 포함)")) return;
    try {
      await cancelNow.mutateAsync({ subscriptionId, reason: "admin_action" });
      toast.success("구독이 취소되었습니다.");
    } catch {
      toast.error("잠시 문제가 생겼어요. 조금 뒤 다시 시도해 주세요.");
    }
  };

  const handleReleaseSuspend = async () => {
    try {
      await releaseSuspend.mutateAsync({ subscriptionId, reason: "admin_release" });
      toast.success("Suspend 가 해제되었습니다.");
    } catch {
      toast.error("잠시 문제가 생겼어요. 조금 뒤 다시 시도해 주세요.");
    }
  };

  return (
    <div className="container mx-auto space-y-6 py-8">
      <PageHeader
        title={`구독 ${subscription.id.slice(0, 8)}`}
        description={`organization ${subscription.organizationId}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setCreditMode("grant")}>
              <PlusCircle className="mr-1 size-3.5" />
              크레딧 지급
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCreditMode("revoke")}>
              <MinusCircle className="mr-1 size-3.5" />
              크레딧 회수
            </Button>
            <Button variant="outline" size="sm" onClick={handleReleaseSuspend}>
              <PauseCircle className="mr-1 size-3.5" />
              Suspend 해제
            </Button>
            <Button variant="destructive" size="sm" onClick={handleCancelNow}>
              <XCircle className="mr-1 size-3.5" />
              즉시 취소
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>구독 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="상태">
              <Badge>{subscription.status}</Badge>
            </Row>
            <Row label="플랜 ID" mono>
              {subscription.planId}
            </Row>
            <Row label="생성일">{new Date(subscription.createdAt).toLocaleString("ko-KR")}</Row>
            <Row label="현재 주기 종료">
              {subscription.currentPeriodEnd
                ? new Date(subscription.currentPeriodEnd).toLocaleString("ko-KR")
                : "—"}
            </Row>
            <Row label="Polar 구독 ID" mono>
              {subscription.polarSubscriptionId ?? "—"}
            </Row>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="size-3.5" />
              크레딧 잔액
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="text-3xl font-bold">{balance.balance.toLocaleString()}</div>
            {balance.lastUpdatedAt ? (
              <p className="text-xs text-muted-foreground">
                마지막 변경: {new Date(balance.lastUpdatedAt).toLocaleString("ko-KR")}
                {balance.source ? ` · ${balance.source}` : ""}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>이벤트 타임라인 (최근 50개)</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">이벤트 없음</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {events.map((evt) => (
                <li
                  key={evt.id}
                  className="flex items-center justify-between border-b py-2 last:border-b-0"
                >
                  <span className="font-medium">{evt.eventType}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(evt.receivedAt).toLocaleString("ko-KR")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {creditMode ? (
        <GrantCreditDialog
          open={!!creditMode}
          mode={creditMode}
          organizationId={subscription.organizationId}
          subscriptionId={subscriptionId}
          onOpenChange={(open) => !open && setCreditMode(null)}
        />
      ) : null}
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
