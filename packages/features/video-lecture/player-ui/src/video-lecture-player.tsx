import { Button } from "@repo/ui/shadcn/button";
import { Card, CardContent } from "@repo/ui/shadcn/card";
import { Progress } from "@repo/ui/shadcn/progress";
import { Lock, PlayCircle, RefreshCw, ShoppingCart } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type VideoLecturePlayerState =
  | "loading"
  | "processing"
  | "failed"
  | "not_logged_in"
  | "purchase_required"
  | "subscription_required"
  | "preview_only"
  | "ready"
  | "expired_token_retry"
  | "archived_private";

export interface VideoLecturePlayback {
  state: VideoLecturePlayerState;
  iframeUrl: string | null;
  hlsUrl?: string | null;
  tokenExpiresAt?: string | null;
  messageCode?: string;
}

export interface VideoLecturePlayerProps {
  title: string;
  posterUrl?: string | null;
  playback: VideoLecturePlayback;
  progressPercent?: number;
  onAuthRequired?: () => void;
  onPurchaseRequired?: () => void;
  onSubscriptionRequired?: () => void;
  onRetryToken?: () => void;
  onProgress?: (currentTimeSeconds: number, totalSeconds: number, completed: boolean) => void;
}

/**
 * @design-ref none - reusable package-level player surface; no approved screen spec exists yet.
 */
export function VideoLecturePlayer({
  title,
  posterUrl,
  playback,
  progressPercent = 0,
  onAuthRequired,
  onPurchaseRequired,
  onSubscriptionRequired,
  onRetryToken,
  onProgress,
}: VideoLecturePlayerProps) {
  const [startedAt] = useState(() => Date.now());
  const lastProgressRef = useRef(0);

  useEffect(() => {
    if (playback.state !== "ready" || !onProgress) return;
    const interval = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      if (elapsed - lastProgressRef.current >= 15) {
        lastProgressRef.current = elapsed;
        onProgress(elapsed, Math.max(elapsed, 1), false);
      }
    }, 5000);
    return () => window.clearInterval(interval);
  }, [onProgress, playback.state, startedAt]);

  return (
    <Card className="overflow-hidden rounded-md">
      <CardContent className="p-0">
        <div className="relative aspect-video bg-muted">
          {playback.state === "ready" && playback.iframeUrl ? (
            <iframe
              title={title}
              src={playback.iframeUrl}
              className="size-full border-0"
              allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
              allowFullScreen
            />
          ) : (
            <PlayerFallback
              title={title}
              posterUrl={posterUrl}
              playback={playback}
              onAuthRequired={onAuthRequired}
              onPurchaseRequired={onPurchaseRequired}
              onSubscriptionRequired={onSubscriptionRequired}
              onRetryToken={onRetryToken}
            />
          )}
        </div>
        <div className="space-y-2 border-t p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 text-sm font-medium truncate">{title}</div>
            <div className="text-xs text-muted-foreground">{Math.max(0, progressPercent)}%</div>
          </div>
          <Progress value={Math.max(0, Math.min(100, progressPercent))} />
        </div>
      </CardContent>
    </Card>
  );
}

function PlayerFallback({
  title,
  posterUrl,
  playback,
  onAuthRequired,
  onPurchaseRequired,
  onSubscriptionRequired,
  onRetryToken,
}: Omit<VideoLecturePlayerProps, "progressPercent" | "onProgress">) {
  const action = getFallbackAction(playback.state);
  const handleAction = () => {
    if (playback.state === "not_logged_in") onAuthRequired?.();
    if (playback.state === "purchase_required") onPurchaseRequired?.();
    if (playback.state === "subscription_required") onSubscriptionRequired?.();
    if (playback.state === "expired_token_retry") onRetryToken?.();
  };

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
      {posterUrl ? (
        <img
          src={posterUrl}
          alt=""
          className="absolute inset-0 size-full object-cover opacity-30"
        />
      ) : null}
      <div className="relative flex size-12 items-center justify-center rounded-full bg-background/80 text-foreground">
        {action.icon}
      </div>
      <div className="relative max-w-sm space-y-1">
        <div className="font-medium">{title}</div>
        <div className="text-sm text-muted-foreground">{action.message}</div>
      </div>
      {action.button ? (
        <Button className="relative" variant="secondary" onClick={handleAction}>
          {action.button}
        </Button>
      ) : null}
    </div>
  );
}

function getFallbackAction(state: VideoLecturePlayerState) {
  switch (state) {
    case "loading":
      return {
        icon: <RefreshCw className="size-5 animate-spin" />,
        message: "영상을 준비하고 있어요.",
      };
    case "processing":
      return {
        icon: <RefreshCw className="size-5 animate-spin" />,
        message: "업로드 처리 중이에요.",
      };
    case "failed":
      return { icon: <RefreshCw className="size-5" />, message: "영상 처리에 문제가 생겼어요." };
    case "not_logged_in":
      return {
        icon: <Lock className="size-5" />,
        message: "로그인 후 이어서 볼 수 있어요.",
        button: "로그인",
      };
    case "purchase_required":
      return {
        icon: <ShoppingCart className="size-5" />,
        message: "구매 후 전체 강의를 볼 수 있어요.",
        button: "구매하기",
      };
    case "subscription_required":
      return {
        icon: <ShoppingCart className="size-5" />,
        message: "구독 플랜에서 제공되는 강의예요.",
        button: "구독 보기",
      };
    case "preview_only":
      return {
        icon: <PlayCircle className="size-5" />,
        message: "미리보기만 제공되는 강의예요.",
      };
    case "expired_token_retry":
      return {
        icon: <RefreshCw className="size-5" />,
        message: "재생 시간이 만료됐어요.",
        button: "다시 불러오기",
      };
    case "archived_private":
      return { icon: <Lock className="size-5" />, message: "현재 볼 수 없는 영상이에요." };
    case "ready":
      return { icon: <PlayCircle className="size-5" />, message: "재생을 시작할 수 있어요." };
  }
}
