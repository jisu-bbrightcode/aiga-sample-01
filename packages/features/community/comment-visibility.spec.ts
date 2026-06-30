import {
  DELETED_COMMENT_PLACEHOLDER,
  type EnrichedCommentRow,
  HIDDEN_COMMENT_PLACEHOLDER,
  REMOVED_COMMENT_PLACEHOLDER,
  toPublicCommentItem,
} from "./comment-visibility";

const createdAt = new Date("2026-01-02T03:04:05.000Z");
const updatedAt = new Date("2026-01-03T03:04:05.000Z");
const editedAt = new Date("2026-01-04T03:04:05.000Z");

function makeRow(overrides: Partial<EnrichedCommentRow> = {}): EnrichedCommentRow {
  return {
    id: "comment-1",
    postId: "post-1",
    authorId: "author-1",
    authorName: "Jane",
    authorAvatar: "https://cdn/a.png",
    parentId: null,
    content: "original body",
    depth: 0,
    isDeleted: false,
    isRemoved: false,
    removalReason: null,
    removedBy: null,
    isEdited: false,
    editedAt: null,
    upvoteCount: 3,
    downvoteCount: 1,
    voteScore: 2,
    replyCount: 0,
    isStickied: false,
    distinguished: null,
    isHidden: false,
    createdAt,
    updatedAt,
    ...overrides,
  };
}

describe("toPublicCommentItem", () => {
  it("passes through a normal comment and serializes dates to ISO", () => {
    const item = toPublicCommentItem(makeRow({ editedAt, isEdited: true }), { userId: null });
    expect(item.content).toBe("original body");
    expect(item.createdAt).toBe(createdAt.toISOString());
    expect(item.updatedAt).toBe(updatedAt.toISOString());
    expect(item.editedAt).toBe(editedAt.toISOString());
  });

  it("never exposes moderation-internal fields (removalReason/removedBy)", () => {
    const item = toPublicCommentItem(
      makeRow({ isRemoved: true, removalReason: "spam", removedBy: "mod-9" }),
      { userId: null },
    );
    expect(item).not.toHaveProperty("removalReason");
    expect(item).not.toHaveProperty("removedBy");
  });

  it("masks deleted comments but keeps the row (tombstone)", () => {
    const item = toPublicCommentItem(makeRow({ isDeleted: true }), { userId: null });
    expect(item.content).toBe(DELETED_COMMENT_PLACEHOLDER);
    expect(item.isDeleted).toBe(true);
    expect(item.id).toBe("comment-1");
  });

  it("masks moderator-removed comments with a generic placeholder", () => {
    const item = toPublicCommentItem(makeRow({ isRemoved: true, content: "[removed]" }), {
      userId: "viewer-2",
    });
    expect(item.content).toBe(REMOVED_COMMENT_PLACEHOLDER);
    expect(item.isRemoved).toBe(true);
  });

  it("hides keyword-filtered content from non-authors", () => {
    const item = toPublicCommentItem(makeRow({ isHidden: true, authorId: "author-1" }), {
      userId: "viewer-2",
    });
    expect(item.content).toBe(HIDDEN_COMMENT_PLACEHOLDER);
    expect(item.isHidden).toBe(true);
  });

  it("shows the author their own keyword-filtered comment", () => {
    const item = toPublicCommentItem(
      makeRow({ isHidden: true, authorId: "author-1", content: "borderline" }),
      { userId: "author-1" },
    );
    expect(item.content).toBe("borderline");
  });

  it("prioritizes deleted over hidden when both flags are set", () => {
    const item = toPublicCommentItem(
      makeRow({ isDeleted: true, isHidden: true, authorId: "author-1" }),
      { userId: "author-1" },
    );
    expect(item.content).toBe(DELETED_COMMENT_PLACEHOLDER);
  });
});
