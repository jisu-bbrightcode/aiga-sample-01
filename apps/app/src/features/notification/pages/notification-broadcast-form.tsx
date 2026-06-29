import { useFeatureTranslation } from "@repo/core/i18n";
import { Button } from "@repo/ui/shadcn/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/shadcn/card";
import { Input } from "@repo/ui/shadcn/input";
import { Label } from "@repo/ui/shadcn/label";
import { Textarea } from "@repo/ui/shadcn/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";

/** REST queryKey base for notification admin stats */
export const NOTIFICATION_STATS_QUERY_KEY = ["get", "/api/notifications/admin/stats"] as const;

/**
 * 공지 발송 폼 (Admin)
 */
export function NotificationBroadcastForm() {
  const { t } = useFeatureTranslation("app");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const queryClient = useQueryClient();

  const broadcast = useMutation({
    mutationKey: ["post", "/api/notifications/admin/broadcast"],
    mutationFn: async (input: { title: string; content: string; targetUserIds?: string[] }) => {
      const { data, error } = await apiClient.POST("/api/notifications/admin/broadcast", {
        body: input,
      });
      if (error) throw error;
      return data!;
    },
    onSuccess: (data) => {
      toast.success(t("notification.broadcastSuccess", { count: data.count }));
      setTitle("");
      setContent("");
      queryClient.invalidateQueries({
        queryKey: NOTIFICATION_STATS_QUERY_KEY,
      });
    },
    onError: () => {
      toast.error(t("errors.notificationBroadcast"));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error(t("errors.notificationBroadcastMissingFields"));
      return;
    }
    broadcast.mutate({ title: title.trim(), content: content.trim() });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>공지 발송</CardTitle>
        <CardDescription>전체 사용자에게 공지 알림을 발송합니다</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">제목</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="공지 제목을 입력하세요"
              maxLength={200}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="content">내용</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="공지 내용을 입력하세요"
              rows={4}
            />
          </div>
          <Button type="submit" disabled={broadcast.isPending}>
            {broadcast.isPending ? (
              <Loader2 className="mr-2 size-3.5 animate-spin" />
            ) : (
              <Send className="mr-2 size-3.5" />
            )}
            발송
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
