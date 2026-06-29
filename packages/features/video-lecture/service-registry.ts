import type { VideoLectureService } from "./service";

export const videoLectureCapabilities = [
  "video-lecture.cloudflare-stream.direct-upload",
  "video-lecture.cloudflare-stream.tus-upload",
  "video-lecture.cloudflare-stream.webhook",
  "video-lecture.cloudflare-stream.signed-playback",
  "video-lecture.cloudflare-stream.progress",
  "video-lecture.cloudflare-stream.admin",
  "video-lecture.cloudflare-stream.player-ui",
] as const;

export type VideoLectureCapability = (typeof videoLectureCapabilities)[number];

export let videoLectureService: VideoLectureService;

export const setVideoLectureService = (service: VideoLectureService) => {
  videoLectureService = service;
};
