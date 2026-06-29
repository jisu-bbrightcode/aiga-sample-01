import { getPostHogServer } from "./posthog-server";
import { sanitize } from "./sanitize";

export interface ServerEventInput {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
  /** PostHog group analytics — 예: { organization: orgId, project: projectId } */
  groups?: Record<string, string>;
}

export interface ServerEventPayload {
  distinctId: string;
  event: string;
  properties: Record<string, unknown>;
  groups?: Record<string, string>;
}

export function buildServerEventPayload(input: ServerEventInput): ServerEventPayload {
  return {
    distinctId: input.distinctId,
    event: input.event,
    properties: sanitize(input.properties) ?? {},
    groups: input.groups,
  };
}

/**
 * 서버/Electron/webhook 발 비즈니스 이벤트를 PostHog 로 캡처.
 * 예: Polar webhook → subscription_activated (클라 success 페이지보다 신뢰성 높음).
 * posthog-node 자체 flush/retry — sanitize + try/catch 만 적용, 절대 throw 안 함.
 */
export function captureServerEvent(input: ServerEventInput): void {
  const client = getPostHogServer();
  if (!client) return;
  try {
    client.capture(buildServerEventPayload(input));
  } catch {
    // swallow
  }
}
