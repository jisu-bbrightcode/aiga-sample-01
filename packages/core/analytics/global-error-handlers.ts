import { captureClientError } from "./capture-client";

/**
 * window 전역 에러 핸들러 등록.
 * Query/Mutation cache·ErrorBoundary 가 못 잡는 사각(타이머·이벤트 핸들러·비동기)을 커버.
 * 재귀 가드는 safeCapture 가 담당하므로 여기서는 등록만.
 *
 * 주의: posthog.init() (PostHogProvider mount) 이전에 발생한 에러는 silently drop 됨 —
 * posthog-js 에 pre-init 큐가 없다. 조기 startup 에러 캡처가 필요하면 별도 버퍼가 필요.
 *
 * @returns unregister 함수 (테스트·HMR 정리용)
 */
export function registerGlobalErrorHandlers(): () => void {
  if (typeof window === "undefined") return () => {};

  const onError = (e: ErrorEvent) =>
    captureClientError(e.error ?? e.message, { source: "window_onerror" });
  const onRejection = (e: PromiseRejectionEvent) =>
    captureClientError(
      e.reason instanceof Error ? e.reason : new Error(String(e.reason)),
      { source: "unhandled_rejection" },
    );

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);

  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}
