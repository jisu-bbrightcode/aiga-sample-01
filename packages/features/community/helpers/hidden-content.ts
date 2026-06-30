/**
 * 콘텐츠 숨김 노출 제외 정책 — 순수 함수 (DB 비의존).
 *
 * 사용자별 숨김(per-viewer mute) 레코드를 목록/상세/댓글/리액션 경로에서
 * 노출 제외하기 위한 변환·판정 로직. DB 쿼리는 서비스가 담당하고, 여기서는
 * 키 생성·분류·포함 판정만 다룬다.
 */

export type HiddenTargetType = "post" | "comment";

export interface HiddenTargetLike {
  targetType: HiddenTargetType;
  targetId: string;
}

/**
 * 숨김 대상의 안정적인 합성 키. 뷰어 스코프 제외 조회(Set lookup)에 사용한다.
 */
export function hiddenTargetKey(targetType: HiddenTargetType, targetId: string): string {
  return `${targetType}:${targetId}`;
}

/**
 * 숨김 레코드를 post/comment id 버킷으로 분리한다.
 * 목록(findAll) / 댓글(findByPost) 의 notInArray 제외 조건에 그대로 넘긴다.
 * 중복 id 는 제거한다.
 */
export function partitionHiddenTargets(records: readonly HiddenTargetLike[]): {
  postIds: string[];
  commentIds: string[];
} {
  const postIds = new Set<string>();
  const commentIds = new Set<string>();

  for (const record of records) {
    if (record.targetType === "post") {
      postIds.add(record.targetId);
    } else if (record.targetType === "comment") {
      commentIds.add(record.targetId);
    }
  }

  return { postIds: [...postIds], commentIds: [...commentIds] };
}

/**
 * 숨김 레코드 목록으로부터 뷰어 스코프 키 집합을 만든다.
 * 상세/리액션 단건 판정에 사용한다.
 */
export function buildHiddenKeySet(records: readonly HiddenTargetLike[]): Set<string> {
  return new Set(records.map((r) => hiddenTargetKey(r.targetType, r.targetId)));
}

/**
 * 특정 대상이 뷰어의 숨김 집합에 포함되는지 판정한다.
 */
export function isHiddenForViewer(
  hiddenKeys: ReadonlySet<string>,
  targetType: HiddenTargetType,
  targetId: string,
): boolean {
  return hiddenKeys.has(hiddenTargetKey(targetType, targetId));
}
