// 클라이언트 전용 — 클라이언트 앱에서 "@repo/core/analytics/client" 로 import
export { captureClientError, captureClientLog } from "./capture-client";
export { captureEvent, registerSuperProperties, setProjectGroup } from "./capture-event";
export { ANALYTICS_EVENTS } from "./events";
export type { AnalyticsEvent } from "./events";
export { registerGlobalErrorHandlers } from "./global-error-handlers";
export { identifyUser, resetUser } from "./identity";
export { PostHogProvider } from "./posthog-provider";
export {
  getBreadcrumbs,
  pushBreadcrumb,
} from "./client/breadcrumb-buffer";
export type { Breadcrumb } from "./client/breadcrumb-buffer";
export type { ClientLogEvent, LogLevel } from "./types";
