import { PageHeader } from "@repo/ui/components/page-header";
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
import { Search } from "lucide-react";
import { useState } from "react";
import { SubscriberTable } from "../components/subscriber-table";
import { type UseSubscribersInput, useSubscribers } from "../hooks/use-subscribers";

const STATUS_OPTIONS: {
  value: NonNullable<UseSubscribersInput["status"]> | "all";
  label: string;
}[] = [
  { value: "all", label: "전체" },
  { value: "active", label: "active" },
  { value: "trialing", label: "trialing" },
  { value: "past_due", label: "past_due" },
  { value: "grace", label: "grace" },
  { value: "canceled", label: "canceled" },
];

export function SubscribersPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  const { data, isLoading } = useSubscribers({
    status: statusFilter === "all" ? undefined : (statusFilter as UseSubscribersInput["status"]),
    search: search || undefined,
    cursor,
    limit: 50,
  });

  return (
    <div className="container mx-auto space-y-6 py-8">
      <PageHeader title="구독자 관리" description="모든 organization 의 구독 상태" />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="orgId / userId 검색"
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
        <SubscriberTable rows={data?.rows ?? []} />
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
