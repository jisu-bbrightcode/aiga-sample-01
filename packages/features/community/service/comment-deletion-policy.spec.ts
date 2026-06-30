/**
 * comment-deletion-policy — DB-free 순수 정책 단위 테스트 (BBR-602).
 *
 * AC#2("관리자 숨김과 작성자 삭제가 상태값으로 구분된다")의 경계와 복구 정책을
 * DB 없이 고정한다.
 */

import { canRestoreComment, deriveCommentModerationStatus } from "./comment-deletion-policy";

const flags = (
  over: Partial<{ isDeleted: boolean; isRemoved: boolean; isHidden: boolean }> = {},
) => ({
  isDeleted: false,
  isRemoved: false,
  isHidden: false,
  ...over,
});

describe("deriveCommentModerationStatus", () => {
  it("공개 댓글 → visible", () => {
    expect(deriveCommentModerationStatus(flags())).toBe("visible");
  });

  it("작성자 삭제 → deleted", () => {
    expect(deriveCommentModerationStatus(flags({ isDeleted: true }))).toBe("deleted");
  });

  it("모더레이터 제거 → removed", () => {
    expect(deriveCommentModerationStatus(flags({ isRemoved: true }))).toBe("removed");
  });

  it("필터 숨김 → hidden", () => {
    expect(deriveCommentModerationStatus(flags({ isHidden: true }))).toBe("hidden");
  });

  it("작성자 삭제는 운영자 제거/숨김보다 우선한다 (상태값 구분 AC#2)", () => {
    expect(
      deriveCommentModerationStatus(flags({ isDeleted: true, isRemoved: true, isHidden: true })),
    ).toBe("deleted");
  });

  it("운영자 제거는 필터 숨김보다 우선한다", () => {
    expect(deriveCommentModerationStatus(flags({ isRemoved: true, isHidden: true }))).toBe(
      "removed",
    );
  });
});

describe("canRestoreComment", () => {
  it("운영자 제거 댓글은 복구 가능", () => {
    expect(canRestoreComment(flags({ isRemoved: true }))).toBe(true);
  });

  it("필터 숨김 댓글은 복구 가능(노출 해제)", () => {
    expect(canRestoreComment(flags({ isHidden: true }))).toBe(true);
  });

  it("작성자 삭제 댓글은 복구 대상이 아니다", () => {
    expect(canRestoreComment(flags({ isDeleted: true }))).toBe(false);
  });

  it("작성자 삭제가 다른 플래그와 겹쳐도 복구 불가(작성자 의사 우선)", () => {
    expect(canRestoreComment(flags({ isDeleted: true, isRemoved: true }))).toBe(false);
  });

  it("이미 공개 상태인 댓글은 복구할 것이 없다", () => {
    expect(canRestoreComment(flags())).toBe(false);
  });
});
