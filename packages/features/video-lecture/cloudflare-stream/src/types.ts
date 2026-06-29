export type CloudflareStreamUploadMethod = "direct" | "tus";

export interface CloudflareStreamConfig {
  accountId: string;
  apiToken: string;
  webhookSecret: string;
  customerSubdomain?: string;
}

export interface DirectCreatorUploadRequest {
  maxDurationSeconds: number;
  requireSignedURLs?: boolean;
}

export interface DirectCreatorUploadResponse {
  uid: string;
  uploadURL: string;
}

export interface TusCreatorUploadRequest {
  uploadLength: number;
  uploadMetadata?: string;
}

export interface TusCreatorUploadResponse {
  location: string;
  streamMediaId?: string;
}

export interface CloudflareStreamStatus {
  state?: string;
  pctComplete?: string;
  errorReasonCode?: string;
  errorReasonText?: string;
  errReasonCode?: string;
  errReasonText?: string;
}

export interface CloudflareStreamWebhookPayload {
  uid: string;
  creator?: string | null;
  thumbnail?: string | null;
  readyToStream?: boolean;
  status?: CloudflareStreamStatus;
  duration?: number | null;
  playback?: {
    hls?: string;
    dash?: string;
  };
  requireSignedURLs?: boolean;
  uploadExpiry?: string | null;
  maxDurationSeconds?: number | null;
  meta?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SignedPlaybackTokenRequest {
  exp?: number;
  downloadable?: boolean;
  accessRules?: Record<string, unknown>;
}

export interface SignedPlaybackTokenResponse {
  token: string;
}

export interface CloudflareApiEnvelope<T> {
  success: boolean;
  result: T;
  errors?: Array<{ code?: number | string; message?: string }>;
  messages?: unknown[];
}

export interface NormalizedProviderError {
  code: string;
  message: string;
  retryable: boolean;
  status?: number;
}
