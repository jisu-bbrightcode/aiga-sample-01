import type { CommunityPost } from "@repo/drizzle/schema";

/**
 * 커뮤니티 게시글 삭제/숨김/복구 상태 정책 (DB-free 순수 로직).
 *
 * 상태값으로 "작성자 삭제" 와 "관리자/모더레이터 숨김·제거" 를 구분한다:
 *
 * - `deleted`   : 작성자 본인이 삭제 (DELETE /community/posts/:id). 내용은 마스킹되며
 *                 작성자 의사이므로 모더레이션 복구 대상이 아니다.
 * - `hidden`    : 모더레이션/자동필터에 의한 숨김 (복구 가능).
 * - `removed`   : 모더레이터가 운영 정책 위반으로 제거 (복구 가능).
 * - `published` : 공개 상태 (복구 목표 상태).
 *
 * 어느 상태에서도 행을 물리 삭제하지 않으므로 댓글/신고/감사 로그는 항상 보존된다.
 */
export type PostStatus = CommunityPost["status"];

/** 모더레이션에 의해 숨겨진 상태(복구 가능). 작성자 삭제(`deleted`)는 제외. */
export const MODERATION_HIDDEN_STATUSES = ["hidden", "removed"] as const;
export type ModerationHiddenStatus = (typeof MODERATION_HIDDEN_STATUSES)[number];

/** 복구 시 되돌릴 목표 상태. */
export const RESTORE_TARGET_STATUS = "published" as const;

/** 게시글이 모더레이션에 의해 숨겨진(복구 가능한) 상태인지 여부. */
export function isModerationHiddenStatus(status: PostStatus): status is ModerationHiddenStatus {
  return (MODERATION_HIDDEN_STATUSES as readonly string[]).includes(status);
}

/**
 * 복구 가능 여부. 모더레이션 숨김/제거 상태만 복구할 수 있고,
 * 작성자 삭제(`deleted`)·임시저장(`draft`)·이미 공개(`published`)는 복구 대상이 아니다.
 */
export function canRestore(status: PostStatus): boolean {
  return isModerationHiddenStatus(status);
}
