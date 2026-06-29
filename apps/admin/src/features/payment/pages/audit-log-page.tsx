import { PageHeader } from "@repo/ui/components/page-header";
import { Button } from "@repo/ui/shadcn/button";
import { Input } from "@repo/ui/shadcn/input";
import { Label } from "@repo/ui/shadcn/label";
import { Skeleton } from "@repo/ui/shadcn/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/shadcn/table";
import { useState } from "react";
import { useAuditLog } from "../hooks/use-audit-log";

export function AuditLogPage() {
  const [actor, setActor] = useState("");
  const [target, setTarget] = useState("");
  const [action, setAction] = useState("");
  const [appliedFilters, setAppliedFilters] = useState<{
    actorUserId?: string;
    targetOrgId?: string;
    action?: string;
  }>({});

  const { data, isLoading } = useAuditLog({ ...appliedFilters, limit: 100 });

  const apply = () => {
    setAppliedFilters({
      actorUserId: actor || undefined,
      targetOrgId: target || undefined,
      action: action || undefined,
    });
  };

  const reset = () => {
    setActor("");
    setTarget("");
    setAction("");
    setAppliedFilters({});
  };

  return (
    <div className="container mx-auto space-y-6 py-8">
      <PageHeader title="Audit Log" description="결제 관련 관리자 액션 기록" />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Filter label="Actor User ID" value={actor} onChange={setActor} />
        <Filter label="Target Org ID" value={target} onChange={setTarget} />
        <Filter
          label="Action"
          value={action}
          onChange={setAction}
          placeholder="grant_credits, refund, ..."
        />
        <div className="flex items-end gap-2">
          <Button onClick={apply}>적용</Button>
          <Button variant="outline" onClick={reset}>
            초기화
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>시각</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target Org</TableHead>
                <TableHead>Target Sub</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.rows ?? []).map((row) => (
                <TableRow key={String(row.id)}>
                  <TableCell className="text-muted-foreground">
                    {new Date(row.createdAt).toLocaleString("ko-KR")}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{row.actorUserId.slice(0, 8)}</TableCell>
                  <TableCell className="font-medium">{row.action}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {row.targetOrgId ? row.targetOrgId.slice(0, 8) : "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {row.targetSubscriptionId ? row.targetSubscriptionId.slice(0, 8) : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.reason ?? "—"}</TableCell>
                </TableRow>
              ))}
              {data && data.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    로그가 없습니다.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function Filter({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
