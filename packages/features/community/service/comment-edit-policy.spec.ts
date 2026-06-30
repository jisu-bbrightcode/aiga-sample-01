import { canEditComment, resolveCommentEditAccess } from "./comment-edit-policy";

describe("resolveCommentEditAccess (BBR-601 AC#1)", () => {
  it("returns 'author' when the requester is the comment author", () => {
    expect(
      resolveCommentEditAccess({ authorId: "u1", requesterId: "u1", isModerator: false }),
    ).toBe("author");
  });

  it("prefers 'author' even when the author is also a moderator", () => {
    expect(resolveCommentEditAccess({ authorId: "u1", requesterId: "u1", isModerator: true })).toBe(
      "author",
    );
  });

  it("returns 'moderator' for a non-author moderator", () => {
    expect(
      resolveCommentEditAccess({ authorId: "u1", requesterId: "mod", isModerator: true }),
    ).toBe("moderator");
  });

  it("returns null (no permission) for a non-author non-moderator", () => {
    expect(
      resolveCommentEditAccess({ authorId: "u1", requesterId: "u2", isModerator: false }),
    ).toBeNull();
  });
});

describe("canEditComment (BBR-601 — tombstone immutability)", () => {
  it("allows editing a normal comment", () => {
    expect(canEditComment({ isDeleted: false, isRemoved: false })).toBe(true);
  });

  it("blocks editing a deleted comment", () => {
    expect(canEditComment({ isDeleted: true, isRemoved: false })).toBe(false);
  });

  it("blocks editing a removed comment", () => {
    expect(canEditComment({ isDeleted: false, isRemoved: true })).toBe(false);
  });
});
