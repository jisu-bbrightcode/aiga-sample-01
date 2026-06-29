import { Badge } from "@repo/ui/shadcn/badge";
import type { VideoLectureAsset } from "../types";

export function VideoLectureStatusBadge({ status }: { status: VideoLectureAsset["status"] }) {
  let variant: "default" | "destructive" | "secondary" = "secondary";
  if (status === "failed" || status === "deleted") {
    variant = "destructive";
  } else if (status === "ready") {
    variant = "default";
  }
  return <Badge variant={variant}>{status}</Badge>;
}
