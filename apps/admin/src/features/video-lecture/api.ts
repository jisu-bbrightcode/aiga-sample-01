import { API_URL, getAuthHeaders } from "../../lib/api";
import type { UploadSessionResult, VideoLectureAsset } from "./types";

export const videoLectureQueryKeys = {
  assets: (status?: string) => ["admin", "video-lecture", "assets", status ?? "all"] as const,
  events: () => ["admin", "video-lecture", "events"] as const,
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error("VIDEO_LECTURE_REQUEST_FAILED");
  }
  return response.json() as Promise<T>;
}

export function listVideoLectureAssets(status?: string) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return request<VideoLectureAsset[]>(`/api/admin/video-lectures${query}`);
}

export function createVideoLectureUpload(input: {
  method: "direct" | "tus";
  maxDurationSeconds: number;
  uploadLength?: number;
  requireSignedUrls: boolean;
  visibility: string;
  entitlementRequirement: string;
}) {
  return request<UploadSessionResult>("/api/admin/video-lectures/uploads", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function archiveVideoLectureAsset(id: string) {
  return request<VideoLectureAsset>(`/api/admin/video-lectures/${id}/archive`, { method: "POST" });
}
