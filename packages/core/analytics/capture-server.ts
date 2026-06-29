import { getPostHogServer } from "./posthog-server";
import { sanitize, sanitizeUrl } from "./sanitize";
import type { ServerErrorEvent } from "./types";

export function resolveServerDistinctId(event: ServerErrorEvent): string {
  return event.userId ?? `anonymous-${event.service ?? "server"}`;
}

export function buildServerErrorPayload(event: ServerErrorEvent): Record<string, unknown> {
  return {
    service: event.service ?? "server",
    path: sanitizeUrl(event.path),
    method: event.method,
    status_code: event.statusCode,
    error_message: event.errorMessage,
    error_code: event.errorCode,
    request_id: event.requestId,
    stack: event.stack,
  };
}

/**
 * 서버/Electron 5xx 에러를 PostHog 로 캡처.
 * posthog-node 는 자체 flush/retry 가 있어 클라이언트와 달리 별도 재귀가드 불필요 —
 * 단 sanitize + try/catch 는 적용한다.
 */
export function captureServerError(event: ServerErrorEvent): void {
  const client = getPostHogServer();
  if (!client) return;
  try {
    client.capture({
      distinctId: resolveServerDistinctId(event),
      event: "server_error",
      properties: sanitize(buildServerErrorPayload(event)) ?? {},
    });
  } catch {
    // swallow
  }
}
