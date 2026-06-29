import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/shadcn/card";
import { Skeleton } from "@repo/ui/shadcn/skeleton";
import { Activity, DollarSign, TrendingDown, Users } from "lucide-react";

interface Stats {
  mrrCents: number;
  arrCents: number;
  activeSubs: number;
  trialingSubs: number;
  churn30d: number;
}

function formatCents(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function PaymentStatsCards({ stats, isLoading }: { stats?: Stats; isLoading: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="MRR"
        icon={<DollarSign className="size-3.5 text-muted-foreground" />}
        value={isLoading || !stats ? null : formatCents(stats.mrrCents)}
        hint="월 반복 매출"
      />
      <StatCard
        title="ARR"
        icon={<TrendingDown className="size-3.5 text-muted-foreground rotate-180" />}
        value={isLoading || !stats ? null : formatCents(stats.arrCents)}
        hint="연 반복 매출"
      />
      <StatCard
        title="활성 구독"
        icon={<Users className="size-3.5 text-muted-foreground" />}
        value={
          isLoading || !stats
            ? null
            : `${stats.activeSubs.toLocaleString()} (체험 ${stats.trialingSubs})`
        }
        hint="active + trialing"
      />
      <StatCard
        title="Churn (30d)"
        icon={<Activity className="size-3.5 text-muted-foreground" />}
        value={isLoading || !stats ? null : `${stats.churn30d.toLocaleString()}건`}
        hint="최근 30일 취소"
      />
    </div>
  );
}

function StatCard({
  title,
  icon,
  value,
  hint,
}: {
  title: string;
  icon: React.ReactNode;
  value: string | null;
  hint: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {value === null ? (
          <Skeleton className="h-7 w-24" />
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
        <p className="text-xs text-muted-foreground mt-1">{hint}</p>
      </CardContent>
    </Card>
  );
}
