import { Badge } from "@repo/ui/shadcn/badge";
import {
  FILE_REVIEW_BADGE_VARIANT,
  FILE_REVIEW_STATUS_LABELS,
  FILE_STATUS_BADGE_VARIANT,
  FILE_STATUS_LABELS,
  type FileReviewStatus,
  type FileStatus,
} from "../types";

/** 파일 lifecycle 상태 배지 (정상 / 대기 / 실패 / 삭제됨). */
export function FileStatusBadge({ status }: { status: FileStatus }) {
  return <Badge variant={FILE_STATUS_BADGE_VARIANT[status]}>{FILE_STATUS_LABELS[status]}</Badge>;
}

/** 파일 검수 상태 배지 (승인 / 대기 / 반려 / 불필요). */
export function FileReviewBadge({ reviewStatus }: { reviewStatus: FileReviewStatus }) {
  return (
    <Badge variant={FILE_REVIEW_BADGE_VARIANT[reviewStatus]}>
      {FILE_REVIEW_STATUS_LABELS[reviewStatus]}
    </Badge>
  );
}
