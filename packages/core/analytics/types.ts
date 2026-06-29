export type LogLevel = "trace" | "debug" | "info" | "warn" | "error";

export interface ServerErrorEvent {
  /** 발생 서비스 — distinctId fallback "anonymous-${service}". 기본 "server" */
  service?: string;
  path: string;
  method: string;
  statusCode: number;
  errorMessage: string;
  errorCode?: string;
  requestId?: string | number;
  userId?: string;
  stack?: string;
}

export interface ClientLogEvent {
  level: LogLevel;
  namespace: string;
  message: string;
  attributes?: Record<string, unknown>;
}

export interface PostHogConfig {
  apiKey: string;
  host: string;
}
