import type { CloudflareStreamWebhookPayload } from "../cloudflare-stream/src";

export type VideoWebhookEventType = "webhook_processing" | "webhook_ready" | "webhook_failed";
export type VideoWebhookAssetStatus = "processing" | "ready" | "failed";

export interface VideoWebhookAssetUpdate {
  eventType: VideoWebhookEventType;
  status: VideoWebhookAssetStatus;
  readyToStream: boolean;
  errorCode: string | null;
  errorMessage: string | null;
}

export function deriveWebhookAssetUpdate(
  payload: CloudflareStreamWebhookPayload,
): VideoWebhookAssetUpdate {
  const errorCode = payload.status?.errorReasonCode ?? payload.status?.errReasonCode ?? null;
  const errorMessage = payload.status?.errorReasonText ?? payload.status?.errReasonText ?? null;

  if (payload.status?.state === "error") {
    return {
      eventType: "webhook_failed",
      status: "failed",
      readyToStream: false,
      errorCode,
      errorMessage,
    };
  }

  if (payload.readyToStream === true) {
    return {
      eventType: "webhook_ready",
      status: "ready",
      readyToStream: true,
      errorCode: null,
      errorMessage: null,
    };
  }

  return {
    eventType: "webhook_processing",
    status: "processing",
    readyToStream: false,
    errorCode: null,
    errorMessage: null,
  };
}
