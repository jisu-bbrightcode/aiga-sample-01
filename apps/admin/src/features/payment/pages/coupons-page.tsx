import { PageHeader } from "@repo/ui/components/page-header";
import { Badge } from "@repo/ui/shadcn/badge";
import { Button } from "@repo/ui/shadcn/button";
import { Skeleton } from "@repo/ui/shadcn/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/shadcn/table";
import { useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { CouponForm, type CouponFormValues } from "../components/coupon-form";
import { useCoupons } from "../hooks/use-coupons";

export function CouponsPage() {
  const navigate = useNavigate();
  const { list, create } = useCoupons();
  const [open, setOpen] = useState(false);

  const handleCreate = async (values: CouponFormValues) => {
    try {
      await create.mutateAsync({
        ...values,
        expiresAt: values.expiresAt ? new Date(values.expiresAt) : undefined,
      });
      toast.success("쿠폰이 생성되었습니다.");
      setOpen(false);
    } catch {
      toast.error("잠시 문제가 생겼어요. 조금 뒤 다시 시도해 주세요.");
    }
  };

  return (
    <div className="container mx-auto space-y-6 py-8">
      <PageHeader
        title="쿠폰"
        description="할인 쿠폰 카탈로그 + 사용 이력"
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-1 size-3.5" />
            쿠폰 만들기
          </Button>
        }
      />

      {list.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>코드</TableHead>
                <TableHead>할인</TableHead>
                <TableHead>기간</TableHead>
                <TableHead>적용</TableHead>
                <TableHead className="text-right">사용</TableHead>
                <TableHead>상태</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Coupon rows have compact derived display columns. */}
              {(list.data ?? []).map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer"
                  onClick={() =>
                    navigate({
                      to: "/payment/coupons/$couponId",
                      params: { couponId: c.id },
                    })
                  }
                >
                  <TableCell className="font-mono text-xs">{c.code}</TableCell>
                  <TableCell>
                    {c.type === "percent"
                      ? `${c.percentOff}%`
                      : `$${((c.amountOffCents ?? 0) / 100).toLocaleString()}`}
                  </TableCell>
                  <TableCell>
                    {c.duration}
                    {c.duration === "repeating" && c.durationInMonths
                      ? ` (${c.durationInMonths}개월)`
                      : ""}
                  </TableCell>
                  <TableCell>{c.appliesTo}</TableCell>
                  <TableCell className="text-right">
                    {c.redemptionCount}
                    {c.maxRedemptions ? ` / ${c.maxRedemptions}` : ""}
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.isActive ? "default" : "secondary"}>
                      {c.isActive ? "active" : "archived"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {list.data && list.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    쿠폰이 없습니다.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      )}

      <CouponForm
        open={open}
        onOpenChange={setOpen}
        onSubmit={handleCreate}
        isPending={create.isPending}
      />
    </div>
  );
}
