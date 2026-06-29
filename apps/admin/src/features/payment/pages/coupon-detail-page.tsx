import { PageHeader } from "@repo/ui/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/shadcn/card";
import { Skeleton } from "@repo/ui/shadcn/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/shadcn/table";
import { useParams } from "@tanstack/react-router";
import { useCouponRedemptions } from "../hooks/use-coupons";

export function CouponDetailPage() {
  const { couponId } = useParams({ strict: false }) as { couponId: string };
  const { data, isLoading } = useCouponRedemptions(couponId);
  const redemptionsContent = (() => {
    if (isLoading) return <Skeleton className="h-32 w-full" />;
    if (!data?.rows?.length) {
      return (
        <p className="py-6 text-center text-sm text-muted-foreground">사용 이력이 없습니다.</p>
      );
    }
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>orgId</TableHead>
            <TableHead>구독 ID</TableHead>
            <TableHead>주문 ID</TableHead>
            <TableHead>사용일</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-mono text-xs">{r.organizationId.slice(0, 8)}</TableCell>
              <TableCell className="font-mono text-xs">
                {r.subscriptionId ? r.subscriptionId.slice(0, 8) : "—"}
              </TableCell>
              <TableCell className="font-mono text-xs">
                {r.orderId ? r.orderId.slice(0, 8) : "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {new Date(r.redeemedAt).toLocaleString("ko-KR")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  })();

  return (
    <div className="container mx-auto space-y-6 py-8">
      <PageHeader title="쿠폰 사용 이력" description={`coupon ${couponId.slice(0, 8)}`} />

      <Card>
        <CardHeader>
          <CardTitle>Redemptions</CardTitle>
        </CardHeader>
        <CardContent>{redemptionsContent}</CardContent>
      </Card>
    </div>
  );
}
