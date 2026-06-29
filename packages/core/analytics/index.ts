// 서버 전용 — 서버/Electron 프로젝트에서 "@repo/core/analytics" 로 import
export { captureServerError } from "./capture-server";
export { buildServerEventPayload, captureServerEvent } from "./capture-server-event";
export type { ServerEventInput } from "./capture-server-event";
export { ANALYTICS_EVENTS } from "./events";
export type { AnalyticsEvent } from "./events";
export {
  getPostHogServer,
  initPostHogServer,
  shutdownPostHogServer,
} from "./posthog-server";
export type { ClientLogEvent, PostHogConfig, ServerErrorEvent } from "./types";
