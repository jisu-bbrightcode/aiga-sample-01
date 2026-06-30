import {
  COMMENT_LIST_SORT_CONTRACT,
  MAX_COMMENT_DEPTH,
  decodeCommentSortKey,
  encodeCommentSortKey,
  resolveReplyDepth,
} from "./comment-ops-policy";

describe("comment-ops-policy (pure)", () => {
  describe("resolveReplyDepth", () => {
    it("최상위 댓글(부모 없음)은 depth 0", () => {
      expect(resolveReplyDepth(null)).toEqual({ ok: true, depth: 0 });
      expect(resolveReplyDepth(undefined)).toEqual({ ok: true, depth: 0 });
    });

    it("부모 depth + 1 을 자식 depth 로 계산한다", () => {
      expect(resolveReplyDepth(0)).toEqual({ ok: true, depth: 1 });
      expect(resolveReplyDepth(3)).toEqual({ ok: true, depth: 4 });
    });

    it("MAX_COMMENT_DEPTH 까지는 허용한다(경계)", () => {
      const r = resolveReplyDepth(MAX_COMMENT_DEPTH - 1);
      expect(r).toEqual({ ok: true, depth: MAX_COMMENT_DEPTH });
    });

    it("MAX_COMMENT_DEPTH 를 초과하는 답글은 거부한다", () => {
      const r = resolveReplyDepth(MAX_COMMENT_DEPTH);
      expect(r).toEqual({ ok: false, reason: "depth_exceeded", maxDepth: MAX_COMMENT_DEPTH });
    });

    it("순수 함수 — 입력을 변형하지 않는다", () => {
      const input = MAX_COMMENT_DEPTH;
      resolveReplyDepth(input);
      expect(input).toBe(MAX_COMMENT_DEPTH);
    });
  });

  describe("comment sort key encode/decode", () => {
    const iso = "2024-01-02T03:04:05.678Z";

    it("고정 여부 + ISO 시각을 round-trip 한다", () => {
      expect(decodeCommentSortKey(encodeCommentSortKey({ stickied: true, createdAt: iso }))).toEqual(
        { stickied: true, createdAt: iso },
      );
      expect(
        decodeCommentSortKey(encodeCommentSortKey({ stickied: false, createdAt: iso })),
      ).toEqual({ stickied: false, createdAt: iso });
    });

    it("ISO 시각의 콜론을 분리자와 혼동하지 않는다(고정 위치 파싱)", () => {
      const decoded = decodeCommentSortKey(`1:${iso}`);
      expect(decoded).toEqual({ stickied: true, createdAt: iso });
    });

    it("플래그 접두사가 없는 과거 cursor 는 stickied=false 로 해석한다(하위호환)", () => {
      expect(decodeCommentSortKey(iso)).toEqual({ stickied: false, createdAt: iso });
    });

    it("빈 문자열/불완전 값은 null", () => {
      expect(decodeCommentSortKey("")).toBeNull();
      expect(decodeCommentSortKey("1:")).toBeNull();
    });
  });

  it("정렬 계약 상수는 고정 우선 + 작성순을 명시한다", () => {
    expect(COMMENT_LIST_SORT_CONTRACT).toContain("isStickied DESC");
    expect(COMMENT_LIST_SORT_CONTRACT).toContain("createdAt");
  });
});
