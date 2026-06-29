import type { CloudflareStreamClient } from "./client";
import type { DirectCreatorUploadRequest, DirectCreatorUploadResponse } from "./types";

export function createDirectCreatorUpload(
  client: CloudflareStreamClient,
  request: DirectCreatorUploadRequest,
): Promise<DirectCreatorUploadResponse> {
  return client.requestJson<DirectCreatorUploadResponse>("/stream/direct_upload", {
    method: "POST",
    body: JSON.stringify({
      maxDurationSeconds: request.maxDurationSeconds,
      ...(typeof request.requireSignedURLs === "boolean"
        ? { requireSignedURLs: request.requireSignedURLs }
        : {}),
    }),
  });
}
