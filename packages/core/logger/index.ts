// 서버 전용 — 서버 프로젝트에서 "@repo/core/logger"로 import

export { createLogger } from "./create-logger";
export { initOtelSdk, shutdownOtelSdk } from "./otel-setup";
export type { Logger, LogLevel, OtelConfig } from "./types";
