import {
  canRestore,
  isModerationHiddenStatus,
  MODERATION_HIDDEN_STATUSES,
  type PostStatus,
  RESTORE_TARGET_STATUS,
} from "./post-deletion-policy";

describe("post-deletion-policy", () => {
  describe("isModerationHiddenStatus", () => {
    it.each(MODERATION_HIDDEN_STATUSES)("treats %s as a moderation-hidden state", (status) => {
      expect(isModerationHiddenStatus(status)).toBe(true);
    });

    it.each([
      "draft",
      "published",
      "deleted",
    ] as PostStatus[])("does not treat %s as a moderation-hidden state", (status) => {
      expect(isModerationHiddenStatus(status)).toBe(false);
    });
  });

  describe("canRestore", () => {
    it("allows restoring moderator-hidden posts", () => {
      expect(canRestore("hidden")).toBe(true);
      expect(canRestore("removed")).toBe(true);
    });

    it("does not allow restoring an author-deleted post", () => {
      // 작성자 삭제는 작성자 의사 → 모더레이션 복구 대상이 아니다.
      expect(canRestore("deleted")).toBe(false);
    });

    it("does not allow restoring drafts or already-published posts", () => {
      expect(canRestore("draft")).toBe(false);
      expect(canRestore("published")).toBe(false);
    });
  });

  it("restores to the published state", () => {
    expect(RESTORE_TARGET_STATUS).toBe("published");
  });
});
