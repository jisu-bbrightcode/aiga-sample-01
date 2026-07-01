import {
  COMMENT_RESTORE_REJECTION_MESSAGE,
  type CommentRestoreState,
  decideCommentRestore,
  DELETED_COMMENT_SENTINEL,
  isCommentContentDestroyed,
  REMOVED_COMMENT_SENTINEL,
} from "./content-restore-policy";

/** Build a comment state snapshot with sensible visible-comment defaults. */
function comment(overrides: Partial<CommentRestoreState> = {}): CommentRestoreState {
  return {
    content: "원래 댓글 본문",
    isRemoved: false,
    isDeleted: false,
    isHidden: false,
    ...overrides,
  };
}

describe("content-restore-policy", () => {
  describe("isCommentContentDestroyed", () => {
    it("treats the removed/deleted sentinels as destroyed", () => {
      expect(isCommentContentDestroyed(REMOVED_COMMENT_SENTINEL)).toBe(true);
      expect(isCommentContentDestroyed(DELETED_COMMENT_SENTINEL)).toBe(true);
    });

    it("treats null / empty / whitespace as destroyed (fail-closed)", () => {
      expect(isCommentContentDestroyed(null)).toBe(true);
      expect(isCommentContentDestroyed("")).toBe(true);
      expect(isCommentContentDestroyed("   ")).toBe(true);
    });

    it("treats real content (incl. surrounding whitespace) as intact", () => {
      expect(isCommentContentDestroyed("실제 본문")).toBe(false);
      expect(isCommentContentDestroyed("  실제 본문  ")).toBe(false);
    });
  });

  describe("decideCommentRestore", () => {
    it("restores a keyword-hidden comment whose content is intact", () => {
      expect(decideCommentRestore(comment({ isHidden: true }))).toEqual({ restorable: true });
    });

    it("restores a removed comment only if the original content survived", () => {
      expect(
        decideCommentRestore(comment({ isRemoved: true, content: "원문이 살아있음" })),
      ).toEqual({ restorable: true });
    });

    it("rejects a removed comment whose content was overwritten with the sentinel", () => {
      expect(
        decideCommentRestore(comment({ isRemoved: true, content: REMOVED_COMMENT_SENTINEL })),
      ).toEqual({ restorable: false, reason: "content_destroyed" });
    });

    it("rejects an author-deleted comment (not a moderation state)", () => {
      expect(
        decideCommentRestore(comment({ isDeleted: true, content: DELETED_COMMENT_SENTINEL })),
      ).toEqual({ restorable: false, reason: "author_deleted" });
    });

    it("author-deletion takes precedence even if also flagged removed/hidden", () => {
      expect(
        decideCommentRestore(
          comment({ isDeleted: true, isRemoved: true, isHidden: true, content: "x" }),
        ),
      ).toEqual({ restorable: false, reason: "author_deleted" });
    });

    it("rejects a comment that is not under any moderation state", () => {
      expect(decideCommentRestore(comment())).toEqual({
        restorable: false,
        reason: "not_moderated",
      });
    });
  });

  describe("COMMENT_RESTORE_REJECTION_MESSAGE", () => {
    it("provides a non-technical message for every rejection reason", () => {
      for (const message of Object.values(COMMENT_RESTORE_REJECTION_MESSAGE)) {
        expect(message.length).toBeGreaterThan(0);
        expect(message).not.toMatch(/error|exception|null|undefined|\[removed\]/i);
      }
    });
  });
});
