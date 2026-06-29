import {
  type Breadcrumb,
  captureClientLog as defaultCaptureLog,
  type ClientLogEvent,
  type LogLevel,
  pushBreadcrumb as defaultPushBreadcrumb,
} from "@repo/core/analytics/client";
import { LOG_LEVEL_ORDER } from "../types";

// 기본 "info" — 다른 임계값이 필요하면 sink.logLevel 로 주입
const DEFAULT_LOG_LEVEL: LogLevel = "info";

export interface ClientLoggerSink {
  pushBreadcrumb: (b: Breadcrumb) => void;
  captureLog: (e: ClientLogEvent) => void;
  logLevel: LogLevel;
}

export interface ClientLogger {
  trace(message: string, attributes?: Record<string, unknown>): void;
  debug(message: string, attributes?: Record<string, unknown>): void;
  info(message: string, attributes?: Record<string, unknown>): void;
  warn(message: string, attributes?: Record<string, unknown>): void;
  error(message: string, attributes?: Record<string, unknown>): void;
}

/**
 * 클라이언트 구조화 로거. sink 주입 가능 (테스트 편의).
 * - 모든 레벨: breadcrumb 기록 (logLevel 게이트 통과 시)
 * - warn/error: captureLog 로 즉시 client_log 이벤트 전송
 */
export function createClientLogger(
  namespace: string,
  sink?: Partial<ClientLoggerSink>,
): ClientLogger {
  const pushBreadcrumb = sink?.pushBreadcrumb ?? defaultPushBreadcrumb;
  const captureLog = sink?.captureLog ?? defaultCaptureLog;
  const logLevel = sink?.logLevel ?? DEFAULT_LOG_LEVEL;
  const minOrder = LOG_LEVEL_ORDER[logLevel];

  function emit(level: LogLevel, message: string, attributes?: Record<string, unknown>): void {
    if (LOG_LEVEL_ORDER[level] < minOrder) return;
    pushBreadcrumb({ ts: Date.now(), level, ns: namespace, message, attrs: attributes });
    if (level === "warn" || level === "error") {
      captureLog({ level, namespace, message, attributes });
    }
  }

  return {
    trace: (m, a) => emit("trace", m, a),
    debug: (m, a) => emit("debug", m, a),
    info: (m, a) => emit("info", m, a),
    warn: (m, a) => emit("warn", m, a),
    error: (m, a) => emit("error", m, a),
  };
}
