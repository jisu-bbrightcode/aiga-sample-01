import { Badge } from "@repo/ui/shadcn/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/shadcn/table";
import { useNavigate } from "@tanstack/react-router";

interface SubscriberRow {
  sub: {
    id: string;
    status: string;
    organizationId: string;
    createdAt: Date | string;
  };
  plan: { name: string | null; priceCents: number | null } | null;
  userEmail: string | null;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  active: "default",
  trialing: "secondary",
  past_due: "destructive",
  grace: "destructive",
  canceled: "outline",
};

export function SubscriberTable({ rows }: { rows: SubscriberRow[] }) {
  const navigate = useNavigate();

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
        구독자가 없습니다.
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>이메일</TableHead>
            <TableHead>플랜</TableHead>
            <TableHead>상태</TableHead>
            <TableHead className="text-right">월 매출</TableHead>
            <TableHead>가입일</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ sub, plan, userEmail }) => (
            <TableRow
              key={sub.id}
              className="cursor-pointer"
              onClick={() =>
                navigate({
                  to: "/payment/subscribers/$subscriptionId",
                  params: { subscriptionId: sub.id },
                })
              }
            >
              <TableCell className="font-medium">{userEmail ?? "(unknown)"}</TableCell>
              <TableCell>{plan?.name ?? "—"}</TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[sub.status] ?? "outline"}>{sub.status}</Badge>
              </TableCell>
              <TableCell className="text-right">
                {plan?.priceCents == null ? "—" : `$${(plan.priceCents / 100).toLocaleString()}`}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {new Date(sub.createdAt).toLocaleDateString("ko-KR")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
