import { Card, CardContent, CardHeader } from "@repo/ui/shadcn/card";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface UsageRow {
  model: string;
  credits: number;
  calls?: number;
}

interface UsageMeterProps {
  rows: UsageRow[];
  isLoading?: boolean;
  rangeDays: number;
}

export function UsageMeter({ rows, isLoading, rangeDays }: UsageMeterProps) {
  const total = rows.reduce((sum, r) => sum + r.credits, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-baseline justify-between">
          <span className="text-base font-semibold">최근 {rangeDays}일 사용량</span>
          <span className="text-sm text-muted-foreground">
            합계 <span className="font-medium text-foreground">{total.toLocaleString("ko-KR")}</span> 크레딧
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-48 w-full animate-pulse rounded bg-muted" />
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            사용 기록이 없습니다.
          </p>
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="model" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value) => {
                    const num = typeof value === "number" ? value : 0;
                    return [`${num.toLocaleString("ko-KR")} 크레딧`, "사용량"];
                  }}
                />
                <Bar dataKey="credits" fill="currentColor" className="text-primary" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
