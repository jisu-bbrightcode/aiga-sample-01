import { PageHeader } from "@repo/ui/components/page-header";
import { Badge } from "@repo/ui/shadcn/badge";
import { Button } from "@repo/ui/shadcn/button";
import { Input } from "@repo/ui/shadcn/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/shadcn/select";
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
import { Search } from "lucide-react";
import { useState } from "react";
import { type UseOrdersInput, useOrders } from "../hooks/use-orders";

const STATUS_OPTIONS: { value: NonNullable<UseOrdersInput["status"]> | "all"; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "paid", label: "paid" },
  { value: "refunded", label: "refunded" },
  { value: "partially_refunded", label: "partial refund" },
  { value: "failed", label: "failed" },
];

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  paid: "default",
  refunded: "secondary",
  partially_refunded: "secondary",
  failed: "destructive",
};

export function OrdersPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [cursor, setCursor] = useState<string | undefined>();

  const { data, isLoading } = useOrders({
    status: statusFilter === "all" ? undefined : (statusFilter as UseOrdersInput["status"]),
    search: search || undefined,
    cursor,
    limit: 50,
  });

  return (
    <div className="container mx-auto space-y-6 py-8">
      <PageHeader title="주문 관리" description="결제 / 환불 이력" />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="orgId / Polar order ID 검색"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setSearch(searchInput);
                setCursor(undefined);
              }
            }}
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            if (v) {
              setStatusFilter(v);
              setCursor(undefined);
            }
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          onClick={() => {
            setSearch(searchInput);
            setCursor(undefined);
          }}
        >
          검색
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>주문 ID</TableHead>
                <TableHead>orgId</TableHead>
                <TableHead className="text-right">금액</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>생성일</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.rows ?? []).map((order) => (
                <TableRow
                  key={order.id}
                  className="cursor-pointer"
                  onClick={() =>
                    navigate({
                      to: "/payment/orders/$orderId",
                      params: { orderId: order.id },
                    })
                  }
                >
                  <TableCell className="font-mono text-xs">{order.id.slice(0, 8)}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {order.organizationId.slice(0, 8)}
                  </TableCell>
                  <TableCell className="text-right">
                    ${(order.amountCents / 100).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[order.status] ?? "outline"}>
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(order.createdAt).toLocaleString("ko-KR")}
                  </TableCell>
                </TableRow>
              ))}
              {data && data.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    주문 없음
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      )}

      {data?.nextCursor ? (
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => setCursor(data.nextCursor ?? undefined)}>
            다음 페이지
          </Button>
        </div>
      ) : null}
    </div>
  );
}
