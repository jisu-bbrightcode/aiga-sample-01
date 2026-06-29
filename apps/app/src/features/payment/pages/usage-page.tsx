import { Button } from "@repo/ui/shadcn/button";
import { Card, CardContent, CardHeader } from "@repo/ui/shadcn/card";
import { useMemo, useState } from "react";
import { UsageMeter } from "../components/usage-meter";
import { useUsageStats } from "../hooks/use-usage";

const RANGES = [
  { days: 7, label: "7일" },
  { days: 30, label: "30일" },
  { days: 90, label: "90일" },
];

export function UsagePage() {
  const [rangeDays, setRangeDays] = useState(30);
  const { data, isLoading } = useUsageStats(rangeDays);

  const rows = useMemo(() => {
    if (!data?.byModel) return [];
    return Object.entries(data.byModel)
      .map(([model, v]) => ({ model, calls: v.calls, credits: v.credits }))
      .sort((a, b) => b.credits - a.credits);
  }, [data]);

  return (
    <div className="container mx-auto max-w-4xl space-y-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">사용량</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            모델별 크레딧 소비를 확인하세요.
          </p>
        </div>
        <div className="flex items-center gap-1">
          {RANGES.map((r) => (
            <Button
              key={r.days}
              size="sm"
              variant={rangeDays === r.days ? "default" : "outline"}
              onClick={() => setRangeDays(r.days)}
            >
              {r.label}
            </Button>
          ))}
        </div>
      </div>

      <UsageMeter rows={rows} isLoading={isLoading} rangeDays={rangeDays} />

      <Card>
        <CardHeader className="pb-3">
          <span className="text-base font-semibold">모델별 상세</span>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-4 w-full animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              사용 기록이 없습니다.
            </p>
          ) : (
            <ul className="divide-y">
              {rows.map((row) => (
                <li
                  key={row.model}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <span className="font-medium">{row.model}</span>
                  <span className="flex items-center gap-3 text-muted-foreground">
                    <span>{row.calls.toLocaleString("ko-KR")} 회</span>
                    <span className="tabular-nums text-foreground">
                      {row.credits.toLocaleString("ko-KR")} 크레딧
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
