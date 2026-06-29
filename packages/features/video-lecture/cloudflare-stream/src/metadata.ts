import type { CloudflareStreamClient } from "./client";

export function updateCloudflareStreamVideoMetadata(
  client: CloudflareStreamClient,
  videoUid: string,
  metadata: { requireSignedURLs?: boolean; allowedOrigins?: string[] },
) {
  return client.requestJson<Record<string, unknown>>(`/stream/${videoUid}`, {
    method: "POST",
    body: JSON.stringify({ uid: videoUid, ...metadata }),
  });
}
