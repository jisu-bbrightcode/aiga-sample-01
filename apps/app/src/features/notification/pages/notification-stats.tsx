import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/shadcn/card";
import { Bell, Calendar, Mail } from "lucide-react";
import { AppQuietLoadingState } from "@/components/app-loading";
import { $api } from "@/lib/api";

/**
 * 알림 통계 카드 (Admin)
 */
export function NotificationStats() {
  const { data, isLoading } = $api.useQuery("get", "/api/notifications/admin/stats", {});

  if (isLoading) {
    return <AppQuietLoadingState label="알림 통계 로딩 중..." />;
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">전체 알림</CardTitle>
          <Bell className="text-muted-foreground size-3.5" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data?.total.toLocaleString() ?? 0}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">읽지 않은 알림</CardTitle>
          <Mail className="text-muted-foreground size-3.5" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data?.unread.toLocaleString() ?? 0}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">오늘 발송</CardTitle>
          <Calendar className="text-muted-foreground size-3.5" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data?.today.toLocaleString() ?? 0}</div>
        </CardContent>
      </Card>
    </div>
  );
}
