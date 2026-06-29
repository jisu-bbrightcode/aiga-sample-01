import type { CloudflareStreamClient } from "./client";
import type { TusCreatorUploadRequest, TusCreatorUploadResponse } from "./types";

export const TUS_MIN_CHUNK_SIZE_BYTES = 5_242_880;
export const TUS_RECOMMENDED_CHUNK_SIZE_BYTES = 52_428_800;
export const TUS_MAX_CHUNK_SIZE_BYTES = 209_715_200;
export const TUS_CHUNK_SIZE_MULTIPLE_BYTES = 262_144;

export function validateTusChunkSize(chunkSizeBytes: number, fileSizeBytes: number): boolean {
  if (fileSizeBytes <= TUS_MIN_CHUNK_SIZE_BYTES && chunkSizeBytes >= fileSizeBytes) return true;
  return (
    chunkSizeBytes >= TUS_MIN_CHUNK_SIZE_BYTES &&
    chunkSizeBytes <= TUS_MAX_CHUNK_SIZE_BYTES &&
    chunkSizeBytes % TUS_CHUNK_SIZE_MULTIPLE_BYTES === 0
  );
}

export async function createTusCreatorUpload(
  client: CloudflareStreamClient,
  request: TusCreatorUploadRequest,
): Promise<TusCreatorUploadResponse> {
  const response = await client.requestRaw("/stream?direct_user=true", {
    method: "POST",
    headers: {
      "Tus-Resumable": "1.0.0",
      "Upload-Length": String(request.uploadLength),
      ...(request.uploadMetadata ? { "Upload-Metadata": request.uploadMetadata } : {}),
    },
  });

  const location = response.headers.get("Location");
  if (!location) {
    throw new Error("VIDEO_LECTURE_TUS_LOCATION_MISSING");
  }

  return {
    location,
    streamMediaId: response.headers.get("stream-media-id") ?? undefined,
  };
}
