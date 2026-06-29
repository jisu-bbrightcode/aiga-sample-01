import type { CloudflareStreamClient } from "./client";
import type { SignedPlaybackTokenRequest, SignedPlaybackTokenResponse } from "./types";

export function createSignedPlaybackToken(
  client: CloudflareStreamClient,
  videoUid: string,
  request: SignedPlaybackTokenRequest = {},
): Promise<SignedPlaybackTokenResponse> {
  return client.requestJson<SignedPlaybackTokenResponse>(`/stream/${videoUid}/token`, {
    method: "POST",
    body: Object.keys(request).length > 0 ? JSON.stringify(request) : undefined,
  });
}

export function buildCloudflareIframeUrl(customerSubdomain: string, tokenOrUid: string): string {
  return `https://${customerSubdomain}.cloudflarestream.com/${tokenOrUid}/iframe`;
}
