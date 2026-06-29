/**
 * @design-ref none - INICIS 운영 콘솔은 확정된 화면정의서/HTML이 없는 신규 admin surface입니다.
 */
import { PageHeader } from "@repo/ui/components/page-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui/shadcn/alert-dialog";
import { Badge } from "@repo/ui/shadcn/badge";
import { Button } from "@repo/ui/shadcn/button";
import { Input } from "@repo/ui/shadcn/input";
import { Label } from "@repo/ui/shadcn/label";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/shadcn/tabs";
import { Textarea } from "@repo/ui/shadcn/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCcw, RotateCcw, Search, ShieldCheck, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  adminPaymentApi,
  adminPaymentQueryKeys,
  type InicisConfigStatus,
  type InicisEvent,
  type InicisOrder,
  type InicisOrderDetail,
} from "../api";

const ORDER_STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  paid: "default",
  approved: "default",
  pending_auth: "outline",
  auth_failed: "destructive",
  failed: "destructive",
  refunded: "secondary",
  partially_refunded: "secondary",
  canceled: "secondary",
};

const EVENT_STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  processed: "default",
  received: "outline",
  replayed: "secondary",
  failed: "destructive",
};

const ORDER_STATUS_OPTIONS = [
  { value: "all", label: "전체 상태" },
  { value: "pending_auth", label: "pending_auth" },
  { value: "auth_failed", label: "auth_failed" },
  { value: "approved", label: "approved" },
  { value: "paid", label: "paid" },
  { value: "canceled", label: "canceled" },
  { value: "partially_refunded", label: "partially_refunded" },
  { value: "refunded", label: "refunded" },
  { value: "failed", label: "failed" },
] as const;

const EVENT_STATUS_OPTIONS = [
  { value: "all", label: "전체 상태" },
  { value: "received", label: "received" },
  { value: "processed", label: "processed" },
  { value: "failed", label: "failed" },
  { value: "replayed", label: "replayed" },
] as const;

interface CancelTarget {
  order: InicisOrder;
  mode: "cancel" | "refund";
}

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: Top-level page coordinates INICIS queries and mutations; UI sections are split below.
export function InicisPage() {
  const queryClient = useQueryClient();
  const [orderSearchInput, setOrderSearchInput] = useState("");
  const [eventSearchInput, setEventSearchInput] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [eventSearch, setEventSearch] = useState("");
  const [orderStatus, setOrderStatus] = useState("all");
  const [eventStatus, setEventStatus] = useState("all");
  const [orderFrom, setOrderFrom] = useState("");
  const [orderTo, setOrderTo] = useState("");
  const [eventFrom, setEventFrom] = useState("");
  const [eventTo, setEventTo] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<CancelTarget | null>(null);
  const [cancelReason, setCancelReason] = useState("admin_action");
  const [partialAmount, setPartialAmount] = useState("");
  const [confirmPrice, setConfirmPrice] = useState("");

  const ordersQuery = {
    search: orderSearch || undefined,
    status: orderStatus === "all" ? undefined : orderStatus,
    from: orderFrom || undefined,
    to: orderTo || undefined,
    limit: 50,
  };
  const eventsQuery = {
    search: eventSearch || undefined,
    status: eventStatus === "all" ? undefined : eventStatus,
    from: eventFrom || undefined,
    to: eventTo || undefined,
    limit: 50,
  };
  const status = useQuery({
    queryKey: adminPaymentQueryKeys.inicisStatus(),
    queryFn: adminPaymentApi.inicisStatus,
  });
  const orders = useQuery({
    queryKey: adminPaymentQueryKeys.inicisOrders(ordersQuery),
    queryFn: () => adminPaymentApi.inicisOrders(ordersQuery),
  });
  const events = useQuery({
    queryKey: adminPaymentQueryKeys.inicisEvents(eventsQuery),
    queryFn: () => adminPaymentApi.inicisEvents(eventsQuery),
  });
  const orderDetail = useQuery({
    queryKey: adminPaymentQueryKeys.inicisOrder(selectedOrderId),
    queryFn: () => adminPaymentApi.inicisOrder(selectedOrderId ?? ""),
    enabled: selectedOrderId !== null,
  });
  const eventDetail = useQuery({
    queryKey: adminPaymentQueryKeys.inicisEvent(selectedEventId),
    queryFn: () => adminPaymentApi.inicisEvent(selectedEventId ?? ""),
    enabled: selectedEventId !== null,
  });

  const invalidateInicis = () =>
    Promise.all([queryClient.invalidateQueries({ queryKey: ["admin", "payment", "inicis"] })]);

  const cancelOrder = useMutation({
    mutationFn: adminPaymentApi.inicisCancelOrder,
    onSuccess: async () => {
      await invalidateInicis();
      toast.success("요청을 접수했습니다.");
      setCancelTarget(null);
      setPartialAmount("");
      setConfirmPrice("");
    },
    onError: () => toast.error("요청을 처리하지 못했습니다."),
  });
  const inquiryOrder = useMutation({
    mutationFn: adminPaymentApi.inicisInquiryOrder,
    onSuccess: async () => {
      await invalidateInicis();
      toast.success("거래조회를 기록했습니다.");
    },
    onError: () => toast.error("거래조회를 처리하지 못했습니다."),
  });
  const replayEvent = useMutation({
    mutationFn: adminPaymentApi.inicisReplayEvent,
    onSuccess: async () => {
      await invalidateInicis();
      toast.success("재처리 요청을 기록했습니다.");
    },
    onError: () => toast.error("재처리 요청을 처리하지 못했습니다."),
  });

  const runOrderSearch = () => setOrderSearch(orderSearchInput.trim());
  const runEventSearch = () => setEventSearch(eventSearchInput.trim());
  const blocker = status.data ? billingBlockerText(status.data) : null;
  const openCancel = (order: InicisOrder) => {
    setCancelTarget({ order, mode: "cancel" });
    setCancelReason("admin_cancel");
  };
  const openRefund = (order: InicisOrder) => {
    setCancelTarget({ order, mode: "refund" });
    setCancelReason("admin_partial_refund");
  };

  return (
    <div className="container mx-auto space-y-6 py-8">
      <PageHeader title="INICIS 결제 운영" description="주문, 노티 이벤트, 설정 상태" />

      <StatusStrip status={status.data} loading={status.isLoading} blocker={blocker} />

      <InicisTabs
        orderSearchInput={orderSearchInput}
        eventSearchInput={eventSearchInput}
        orderStatus={orderStatus}
        eventStatus={eventStatus}
        orderFrom={orderFrom}
        orderTo={orderTo}
        eventFrom={eventFrom}
        eventTo={eventTo}
        ordersLoading={orders.isLoading}
        eventsLoading={events.isLoading}
        orders={orders.data?.rows ?? []}
        events={events.data?.rows ?? []}
        onOrderSearchInput={setOrderSearchInput}
        onEventSearchInput={setEventSearchInput}
        onOrderStatus={setOrderStatus}
        onEventStatus={setEventStatus}
        onOrderFrom={setOrderFrom}
        onOrderTo={setOrderTo}
        onEventFrom={setEventFrom}
        onEventTo={setEventTo}
        onOrderSearch={runOrderSearch}
        onEventSearch={runEventSearch}
        onOrderSelect={(order) => setSelectedOrderId(order.orderId)}
        onEventSelect={(event) => setSelectedEventId(event.id)}
        onCancel={openCancel}
        onRefund={openRefund}
        onInquiry={(order) => inquiryOrder.mutate(order.orderId)}
        onReplay={(event) => replayEvent.mutate(event.id)}
      />

      <DetailPanels
        orderDetail={orderDetail.data}
        orderLoading={orderDetail.isLoading}
        eventDetail={eventDetail.data?.event}
        eventLoading={eventDetail.isLoading}
        onCloseOrder={() => setSelectedOrderId(null)}
        onCloseEvent={() => setSelectedEventId(null)}
      />

      <CancelRequestDialog
        target={cancelTarget}
        reason={cancelReason}
        partialAmount={partialAmount}
        confirmPrice={confirmPrice}
        onReason={setCancelReason}
        onPartialAmount={setPartialAmount}
        onConfirmPrice={setConfirmPrice}
        onClose={() => setCancelTarget(null)}
        onSubmit={(target) =>
          cancelOrder.mutate({
            orderId: target.order.orderId,
            reason: cancelReason || "admin_action",
            amount: target.mode === "refund" && partialAmount ? Number(partialAmount) : undefined,
            confirmPrice:
              target.mode === "refund" && confirmPrice ? Number(confirmPrice) : undefined,
          })
        }
      />
    </div>
  );
}

function InicisTabs({
  orderSearchInput,
  eventSearchInput,
  orderStatus,
  eventStatus,
  orderFrom,
  orderTo,
  eventFrom,
  eventTo,
  ordersLoading,
  eventsLoading,
  orders,
  events,
  onOrderSearchInput,
  onEventSearchInput,
  onOrderStatus,
  onEventStatus,
  onOrderFrom,
  onOrderTo,
  onEventFrom,
  onEventTo,
  onOrderSearch,
  onEventSearch,
  onOrderSelect,
  onEventSelect,
  onCancel,
  onRefund,
  onInquiry,
  onReplay,
}: {
  orderSearchInput: string;
  eventSearchInput: string;
  orderStatus: string;
  eventStatus: string;
  orderFrom: string;
  orderTo: string;
  eventFrom: string;
  eventTo: string;
  ordersLoading: boolean;
  eventsLoading: boolean;
  orders: InicisOrder[];
  events: InicisEvent[];
  onOrderSearchInput: (value: string) => void;
  onEventSearchInput: (value: string) => void;
  onOrderStatus: (value: string) => void;
  onEventStatus: (value: string) => void;
  onOrderFrom: (value: string) => void;
  onOrderTo: (value: string) => void;
  onEventFrom: (value: string) => void;
  onEventTo: (value: string) => void;
  onOrderSearch: () => void;
  onEventSearch: () => void;
  onOrderSelect: (order: InicisOrder) => void;
  onEventSelect: (event: InicisEvent) => void;
  onCancel: (order: InicisOrder) => void;
  onRefund: (order: InicisOrder) => void;
  onInquiry: (order: InicisOrder) => void;
  onReplay: (event: InicisEvent) => void;
}) {
  return (
    <Tabs defaultValue="orders" className="space-y-4">
      <TabsList>
        <TabsTrigger value="orders">주문</TabsTrigger>
        <TabsTrigger value="events">노티 이벤트</TabsTrigger>
      </TabsList>
      <TabsContent value="orders" className="space-y-4">
        <SearchBar
          value={orderSearchInput}
          status={orderStatus}
          from={orderFrom}
          to={orderTo}
          statusOptions={ORDER_STATUS_OPTIONS}
          placeholder="orderId / tid / userId 검색"
          onChange={onOrderSearchInput}
          onStatus={onOrderStatus}
          onFrom={onOrderFrom}
          onTo={onOrderTo}
          onSubmit={onOrderSearch}
        />
        {ordersLoading ? (
          <Skeleton className="h-72 w-full" />
        ) : (
          <OrdersTable
            rows={orders}
            onSelect={onOrderSelect}
            onCancel={onCancel}
            onRefund={onRefund}
            onInquiry={onInquiry}
          />
        )}
      </TabsContent>
      <TabsContent value="events" className="space-y-4">
        <SearchBar
          value={eventSearchInput}
          status={eventStatus}
          from={eventFrom}
          to={eventTo}
          statusOptions={EVENT_STATUS_OPTIONS}
          placeholder="orderId / tid / idempotency key 검색"
          onChange={onEventSearchInput}
          onStatus={onEventStatus}
          onFrom={onEventFrom}
          onTo={onEventTo}
          onSubmit={onEventSearch}
        />
        {eventsLoading ? (
          <Skeleton className="h-72 w-full" />
        ) : (
          <EventsTable rows={events} onSelect={onEventSelect} onReplay={onReplay} />
        )}
      </TabsContent>
    </Tabs>
  );
}

function CancelRequestDialog({
  target,
  reason,
  partialAmount,
  confirmPrice,
  onReason,
  onPartialAmount,
  onConfirmPrice,
  onClose,
  onSubmit,
}: {
  target: CancelTarget | null;
  reason: string;
  partialAmount: string;
  confirmPrice: string;
  onReason: (value: string) => void;
  onPartialAmount: (value: string) => void;
  onConfirmPrice: (value: string) => void;
  onClose: () => void;
  onSubmit: (target: CancelTarget) => void;
}) {
  return (
    <AlertDialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {target?.mode === "refund" ? "부분환불 요청" : "전체취소 요청"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            결제사 요청 결과는 이벤트 로그에 masked payload로 기록됩니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3">
          <Label htmlFor="inicis-cancel-reason">사유</Label>
          <Textarea
            id="inicis-cancel-reason"
            value={reason}
            onChange={(event) => onReason(event.target.value)}
          />
          {target?.mode === "refund" ? (
            <PartialRefundFields
              partialAmount={partialAmount}
              confirmPrice={confirmPrice}
              onPartialAmount={onPartialAmount}
              onConfirmPrice={onConfirmPrice}
            />
          ) : null}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>취소</AlertDialogCancel>
          <AlertDialogAction onClick={() => target && onSubmit(target)}>요청</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function PartialRefundFields({
  partialAmount,
  confirmPrice,
  onPartialAmount,
  onConfirmPrice,
}: {
  partialAmount: string;
  confirmPrice: string;
  onPartialAmount: (value: string) => void;
  onConfirmPrice: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="inicis-refund-amount">환불 금액</Label>
        <Input
          id="inicis-refund-amount"
          inputMode="numeric"
          value={partialAmount}
          onChange={(event) => onPartialAmount(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="inicis-confirm-price">잔여 금액</Label>
        <Input
          id="inicis-confirm-price"
          inputMode="numeric"
          value={confirmPrice}
          onChange={(event) => onConfirmPrice(event.target.value)}
        />
      </div>
    </div>
  );
}

function StatusStrip({
  status,
  loading,
  blocker,
}: {
  status?: InicisConfigStatus;
  loading: boolean;
  blocker: string | null;
}) {
  if (loading) return <Skeleton className="h-24 w-full" />;
  return (
    <div className="grid gap-3 md:grid-cols-6">
      <StatusCell
        label="설정"
        value={status?.configured ? "configured" : "missing"}
        ok={status?.configured}
      />
      <StatusCell
        label="MID"
        value={status?.midPresent ? "present" : "missing"}
        ok={status?.midPresent}
      />
      <StatusCell
        label="API Key"
        value={status?.iniApiKeyPresent ? "present" : "missing"}
        ok={status?.iniApiKeyPresent}
      />
      <StatusCell
        label="Noti IP"
        value={status?.notiAllowedIpConfigured ? "configured" : "missing"}
        ok={status?.notiAllowedIpConfigured}
      />
      <StatusCell
        label="Proxy"
        value={status?.trustProxy ? "trusted" : "direct"}
        ok={!status?.trustProxy}
      />
      <StatusCell label="Billing" value={blocker ?? "unverified"} ok={false} />
    </div>
  );
}

function StatusCell({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        {ok ? (
          <ShieldCheck className="size-4 text-emerald-600" />
        ) : (
          <XCircle className="size-4 text-muted-foreground" />
        )}
      </div>
      <div className="mt-2 truncate text-xs text-muted-foreground">{value}</div>
    </div>
  );
}

function SearchBar({
  value,
  status,
  from,
  to,
  statusOptions,
  placeholder,
  onChange,
  onStatus,
  onFrom,
  onTo,
  onSubmit,
}: {
  value: string;
  status: string;
  from: string;
  to: string;
  statusOptions: readonly { value: string; label: string }[];
  placeholder: string;
  onChange: (value: string) => void;
  onStatus: (value: string) => void;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-72 flex-1">
        <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onSubmit();
          }}
        />
      </div>
      <Select value={status} onValueChange={(next) => next && onStatus(next)}>
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        className="w-40"
        type="date"
        aria-label="시작일"
        value={from}
        onChange={(event) => onFrom(event.target.value)}
      />
      <Input
        className="w-40"
        type="date"
        aria-label="종료일"
        value={to}
        onChange={(event) => onTo(event.target.value)}
      />
      <Button variant="outline" onClick={onSubmit}>
        검색
      </Button>
    </div>
  );
}

function OrdersTable({
  rows,
  onSelect,
  onCancel,
  onRefund,
  onInquiry,
}: {
  rows: InicisOrder[];
  onSelect: (order: InicisOrder) => void;
  onCancel: (order: InicisOrder) => void;
  onRefund: (order: InicisOrder) => void;
  onInquiry: (order: InicisOrder) => void;
}) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>주문</TableHead>
            <TableHead>구매자</TableHead>
            <TableHead className="text-right">금액</TableHead>
            <TableHead>상태</TableHead>
            <TableHead>TID</TableHead>
            <TableHead>승인/입금</TableHead>
            <TableHead className="text-right">작업</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((order) => (
            <TableRow key={order.id}>
              <TableCell>
                <div className="font-mono text-xs">{order.orderId}</div>
                <div className="text-xs text-muted-foreground">{order.goodsName}</div>
              </TableCell>
              <TableCell>
                <div className="text-sm">{order.buyerNameMasked ?? "-"}</div>
                <div className="text-xs text-muted-foreground">{order.buyerEmailMasked ?? "-"}</div>
              </TableCell>
              <TableCell className="text-right">
                {order.amount.toLocaleString("ko-KR")} {order.currency}
              </TableCell>
              <TableCell>
                <Badge variant={ORDER_STATUS_VARIANT[order.status] ?? "outline"}>
                  {order.status}
                </Badge>
              </TableCell>
              <TableCell className="max-w-40 truncate font-mono text-xs">
                {order.tid ?? "-"}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {formatDate(order.paidAt ?? order.approvedAt)}
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => onSelect(order)}>
                    상세
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onInquiry(order)}>
                    <RefreshCcw className="size-3.5" />
                    조회
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onRefund(order)}>
                    부분환불
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => onCancel(order)}>
                    전체취소
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                주문 없음
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}

function EventsTable({
  rows,
  onSelect,
  onReplay,
}: {
  rows: InicisEvent[];
  onSelect: (event: InicisEvent) => void;
  onReplay: (event: InicisEvent) => void;
}) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>이벤트</TableHead>
            <TableHead>주문/TID</TableHead>
            <TableHead>상태</TableHead>
            <TableHead>수신</TableHead>
            <TableHead>Masked payload</TableHead>
            <TableHead className="text-right">작업</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((event) => (
            <TableRow key={event.id}>
              <TableCell>
                <div className="text-sm font-medium">{event.eventType}</div>
                <div className="max-w-48 truncate font-mono text-xs text-muted-foreground">
                  {event.idempotencyKey}
                </div>
              </TableCell>
              <TableCell>
                <div className="font-mono text-xs">{event.orderId ?? "-"}</div>
                <div className="max-w-40 truncate font-mono text-xs text-muted-foreground">
                  {event.tid ?? "-"}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={EVENT_STATUS_VARIANT[event.status] ?? "outline"}>
                  {event.status}
                </Badge>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {formatDate(event.createdAt)}
              </TableCell>
              <TableCell>
                <div className="max-w-72 truncate font-mono text-xs text-muted-foreground">
                  {JSON.stringify(event.rawMasked)}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => onSelect(event)}>
                    상세
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onReplay(event)}>
                    <RotateCcw className="size-3.5" />
                    재처리
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                이벤트 없음
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}

function DetailPanels({
  orderDetail,
  orderLoading,
  eventDetail,
  eventLoading,
  onCloseOrder,
  onCloseEvent,
}: {
  orderDetail?: InicisOrderDetail;
  orderLoading: boolean;
  eventDetail?: InicisEvent;
  eventLoading: boolean;
  onCloseOrder: () => void;
  onCloseEvent: () => void;
}) {
  if (!orderDetail && !eventDetail && !orderLoading && !eventLoading) return null;
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {orderLoading ? <Skeleton className="h-96 w-full" /> : null}
      {orderDetail ? <OrderDetailPanel detail={orderDetail} onClose={onCloseOrder} /> : null}
      {eventLoading ? <Skeleton className="h-96 w-full" /> : null}
      {eventDetail ? <EventDetailPanel event={eventDetail} onClose={onCloseEvent} /> : null}
    </div>
  );
}

function OrderDetailPanel({ detail, onClose }: { detail: InicisOrderDetail; onClose: () => void }) {
  const { order, events, entitlementStatus } = detail;
  return (
    <section className="rounded-lg border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">주문 상세</h2>
          <div className="mt-1 font-mono text-xs text-muted-foreground">{order.orderId}</div>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose}>
          닫기
        </Button>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <KeyValue label="User" value={order.userId ?? "-"} />
        <KeyValue label="OID/MOID" value={order.orderId} />
        <KeyValue label="TID" value={order.tid ?? "-"} />
        <KeyValue label="Auth TID" value={order.authTid ?? "-"} />
        <KeyValue
          label="Amount"
          value={`${order.amount.toLocaleString("ko-KR")} ${order.currency}`}
        />
        <KeyValue label="Refunded" value={order.refundedAmount.toLocaleString("ko-KR")} />
        <KeyValue label="Approved" value={formatDate(order.approvedAt)} />
        <KeyValue label="Paid" value={formatDate(order.paidAt)} />
        <KeyValue label="Canceled" value={formatDate(order.canceledAt)} />
        <KeyValue label="Result" value={order.providerResultCode ?? "-"} />
      </div>
      <div className="mt-4 rounded-md border p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">Entitlement</span>
          <Badge variant={entitlementStatus.status === "blocked" ? "destructive" : "outline"}>
            {entitlementStatus.status}
          </Badge>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">{entitlementStatus.message}</div>
      </div>
      <Timeline events={events} />
      <JsonBlock label="Masked order payload" value={order.rawMasked} />
    </section>
  );
}

function EventDetailPanel({ event, onClose }: { event: InicisEvent; onClose: () => void }) {
  return (
    <section className="rounded-lg border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">이벤트 상세</h2>
          <div className="mt-1 font-mono text-xs text-muted-foreground">{event.id}</div>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose}>
          닫기
        </Button>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <KeyValue label="Type" value={event.eventType} />
        <KeyValue label="Status" value={event.status} />
        <KeyValue label="Order" value={event.orderId ?? "-"} />
        <KeyValue label="TID" value={event.tid ?? "-"} />
        <KeyValue label="Source IP" value={event.sourceIp ?? "-"} />
        <KeyValue label="Result" value={event.providerResultCode ?? "-"} />
        <KeyValue label="Received" value={formatDate(event.createdAt)} />
        <KeyValue label="Processed" value={formatDate(event.processedAt)} />
      </div>
      <JsonBlock label="Masked raw payload" value={event.rawMasked} />
      <JsonBlock label="Normalized payload" value={event.normalized} />
    </section>
  );
}

function Timeline({ events }: { events: InicisEvent[] }) {
  return (
    <div className="mt-4 space-y-2">
      <h3 className="text-sm font-medium">Timeline</h3>
      <div className="space-y-2">
        {events.map((event) => (
          <div
            key={event.id}
            className="grid gap-2 rounded-md border p-3 md:grid-cols-[160px_1fr_auto]"
          >
            <span className="text-xs text-muted-foreground">{formatDate(event.createdAt)}</span>
            <span className="text-sm">{event.eventType}</span>
            <Badge variant={EVENT_STATUS_VARIANT[event.status] ?? "outline"}>{event.status}</Badge>
          </div>
        ))}
        {events.length === 0 ? (
          <div className="rounded-md border p-3 text-sm text-muted-foreground">이벤트 없음</div>
        ) : null}
      </div>
    </div>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 truncate font-mono text-xs">{value}</div>
    </div>
  );
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="mt-4">
      <h3 className="text-sm font-medium">{label}</h3>
      <pre className="mt-2 max-h-72 overflow-auto rounded-md border bg-muted/30 p-3 text-xs">
        {formatJson(value)}
      </pre>
    </div>
  );
}

function formatJson(value: unknown): string {
  if (value === null || value === undefined) return "-";
  return JSON.stringify(value, null, 2);
}

function billingBlockerText(status: InicisConfigStatus): string {
  if (typeof status.billingBlocker === "string") return status.billingBlocker;
  return status.billingBlocker.code;
}

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleString("ko-KR");
}
