import type { CloudflareStreamClient } from "./client";

export async function deleteCloudflareStreamVideo(
  client: CloudflareStreamClient,
  videoUid: string,
) {
  await client.requestRaw(`/stream/${videoUid}`, { method: "DELETE" });
  return { ok: true };
}
