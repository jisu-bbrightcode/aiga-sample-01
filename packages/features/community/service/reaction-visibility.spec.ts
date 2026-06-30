/**
 * reaction-visibility — 순수 노출 정책 단위 테스트 (BBR-611 / AC#2).
 *
 * DB 없이 게시글/댓글 리액션 노출 경계를 고정한다.
 */
import {
  COMMUNITY_COMMENT_REACTION_TARGET,
  COMMUNITY_POST_REACTION_TARGET,
  type CommentReactionVisibility,
  isCommentReactable,
  isPostReactable,
} from "./reaction-visibility";

const POST_STATUSES = ["draft", "published", "hidden", "removed", "deleted"] as const;
const NON_PUBLISHED_STATUSES = ["draft", "hidden", "removed", "deleted"] as const;

describe("reaction-visibility (BBR-611)", () => {
  describe("target type constants", () => {
    it("namespaces community targets to avoid cross-feature collision", () => {
      expect(COMMUNITY_POST_REACTION_TARGET).toBe("community_post");
      expect(COMMUNITY_COMMENT_REACTION_TARGET).toBe("community_comment");
    });
  });

  describe("isPostReactable", () => {
    it("exposes reactions only for published posts", () => {
      expect(isPostReactable("published")).toBe(true);
    });

    it.each(NON_PUBLISHED_STATUSES)("hides reactions for %s posts (AC#2)", (status) => {
      expect(isPostReactable(status)).toBe(false);
    });

    it("covers every post status enum value", () => {
      // Guard against drift: every status resolves to a boolean.
      for (const status of POST_STATUSES) {
        expect(typeof isPostReactable(status)).toBe("boolean");
      }
    });
  });

  describe("isCommentReactable", () => {
    const visible: CommentReactionVisibility = {
      postStatus: "published",
      isDeleted: false,
      isRemoved: false,
      isHidden: false,
    };

    it("exposes reactions for a live comment under a published post", () => {
      expect(isCommentReactable(visible)).toBe(true);
    });

    it("hides reactions when the comment is deleted (AC#2)", () => {
      expect(isCommentReactable({ ...visible, isDeleted: true })).toBe(false);
    });

    it("hides reactions when the comment is moderator-removed (AC#2)", () => {
      expect(isCommentReactable({ ...visible, isRemoved: true })).toBe(false);
    });

    it("hides reactions when the comment is keyword-hidden (AC#2)", () => {
      expect(isCommentReactable({ ...visible, isHidden: true })).toBe(false);
    });

    it.each(
      NON_PUBLISHED_STATUSES,
    )("hides reactions when the parent post is %s, even for a live comment", (postStatus) => {
      expect(isCommentReactable({ ...visible, postStatus })).toBe(false);
    });
  });
});
