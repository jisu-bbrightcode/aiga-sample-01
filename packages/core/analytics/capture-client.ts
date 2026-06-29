import posthog from "posthog-js";
import { getBreadcrumbs } from "./client/breadcrumb-buffer";
import { safeCapture } from "./safe-capture";
import { sanitizeUrl } from "./sanitize";
import type { ClientLogEvent } from "./types";

export function buildClientErrorPayload(
  error: Error | string,
  properties: Record<string, unknown> | undefined,
  url: string,
): Record<string, unknown> {
  return {
    error_message: typeof error === "string" ? error : error.message,
    error_name: typeof error === "string" ? "Error" : error.name,
    error_stack: typeof error === "string" ? undefined : error.stack,
    url,
    breadcrumbs: getBreadcrumbs(),
    ...properties,
  };
}

export function buildClientLogPayload(event: ClientLogEvent): Record<string, unknown> {
  return {
    level: event.level,
    namespace: event.namespace,
    message: event.message,
    attributes: event.attributes,
  };
}

const phCapture = (event: string, props: Record<string, unknown>) => posthog.capture(event, props);

export function captureClientError(
  error: Error | string,
  properties?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  safeCapture(
    "client_error",
    () => buildClientErrorPayload(error, properties, sanitizeUrl(window.location.href)),
    phCapture,
  );
}

export function captureClientLog(event: ClientLogEvent): void {
  if (typeof window === "undefined") return;
  safeCapture("client_log", () => buildClientLogPayload(event), phCapture);
}
