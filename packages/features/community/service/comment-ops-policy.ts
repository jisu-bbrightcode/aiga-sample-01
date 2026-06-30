/**
 * 커뮤니티 댓글 운영(ops) 정책 — 순수 함수/상수 (PB-COMM-COMMENT-OPS-API-001 / BBR-604).
 *
 * 운영 액션(remove/sticky/distinguish)과 대댓글 depth 제한·정렬 정책을 한 곳에서
 * 고정한다. 여기 정의된 상수/함수는 OpenAPI contract 와 서비스 구현이 공유하는
 * "단일 출처(single source of truth)"다 — AC#2("대댓글 depth 제한과 정렬 정책이
 * contract 에 명시된다")의 근거.
 *
 * 모든 함수는 DB/I/O 의존이 없는 순수 함수이므로 단위 테스트로 직접 검증한다.
 */

/**
 * 대댓글 최대 depth (0-indexed).
 * - depth 0 = 최상위 댓글
 * - depth 1 = 댓글에 대한 답글
 * - ...
 * - depth {@link MAX_COMMENT_DEPTH} = 허용되는 가장 깊은 답글
 *
 * 즉 스레드는 총 `MAX_COMMENT_DEPTH + 1` 단계까지 중첩될 수 있다. 이보다 깊은
 * 답글은 거부된다(서비스에서 400). 무한 중첩으로 인한 렌더링/정렬 비용 폭증과
 * 모더레이션 난이도를 막기 위한 상한이다.
 */
export const MAX_COMMENT_DEPTH = 5;

/** 대댓글 depth 한도 검사 결과(순수). 서비스가 이를 HTTP 예외로 변환한다. */
export type ReplyDepthResolution =
  | { readonly ok: true; readonly depth: number }
  | { readonly ok: false; readonly reason: "depth_exceeded"; readonly maxDepth: number };

/**
 * 부모 댓글의 depth 로부터 자식(답글) depth 를 계산한다.
 *
 * @param parentDepth 부모 댓글 depth. 최상위 댓글(부모 없음)이면 `null`.
 * @returns 한도 이내면 `{ ok: true, depth }`, 초과면 `{ ok: false }`.
 */
export function resolveReplyDepth(parentDepth: number | null | undefined): ReplyDepthResolution {
  if (parentDepth == null) {
    return { ok: true, depth: 0 };
  }
  const childDepth = parentDepth + 1;
  if (childDepth > MAX_COMMENT_DEPTH) {
    return { ok: false, reason: "depth_exceeded", maxDepth: MAX_COMMENT_DEPTH };
  }
  return { ok: true, depth: childDepth };
}

/**
 * 댓글 목록 정렬 계약(sort contract).
 *
 * 고정 댓글(isStickied=true)을 항상 상단에 배치하고, 그 안에서 작성 시각으로
 * 정렬한다. `sort=new`면 최신순(desc), 그 외(기본 `old`)면 오래된 순(asc).
 * 정렬 키는 cursor 페이지네이션과 일관되도록 `(isStickied, createdAt, id)`
 * 3-튜플을 사용한다.
 */
export const COMMENT_LIST_SORT_CONTRACT =
  "isStickied DESC, createdAt (sort=new ? DESC : ASC), id (tie-breaker)";

/** 댓글 cursor 정렬 키(순수). `(isStickied, createdAt)` 를 단일 문자열로 packing 한다. */
export interface CommentSortKey {
  readonly stickied: boolean;
  readonly createdAt: string;
}

/**
 * 정렬 키를 cursor value 문자열로 인코딩한다.
 * 형식: `"<1|0>:<ISO8601>"`. 첫 글자(고정 여부)가 비교 우선순위를 가진다.
 * ISO8601 자체가 `:` 를 포함하므로, 접두 플래그는 항상 1글자로 고정한다.
 */
export function encodeCommentSortKey(key: CommentSortKey): string {
  return `${key.stickied ? 1 : 0}:${key.createdAt}`;
}

/**
 * cursor value 문자열을 정렬 키로 디코딩한다. 형식이 어긋나면 `null`.
 * (구버전 cursor — `createdAt` ISO 단독 — 는 stickied=false 로 안전하게 해석한다.)
 *
 * ISO8601 에도 `:` 가 있으므로 split 이 아니라 **고정 위치**(0번=플래그, 1번=`:`)
 * 로 판별한다.
 */
export function decodeCommentSortKey(value: string): CommentSortKey | null {
  if (value.length === 0) {
    return null;
  }
  const hasFlagPrefix = (value[0] === "0" || value[0] === "1") && value[1] === ":";
  if (!hasFlagPrefix) {
    // 하위호환: stickied 접두사가 없는 과거 cursor(ISO 단독).
    return { stickied: false, createdAt: value };
  }
  const createdAt = value.slice(2);
  if (createdAt.length === 0) {
    return null;
  }
  return { stickied: value[0] === "1", createdAt };
}
