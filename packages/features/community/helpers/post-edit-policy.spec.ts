import { diffPostEdit, resolvePostEditAccess } from "./post-edit-policy";

describe("resolvePostEditAccess", () => {
  it("routes the author to the author edit path", () => {
    expect(resolvePostEditAccess({ isAuthor: true, isModerator: false })).toBe("author");
  });

  it("prefers the author path even when the author is also a moderator", () => {
    // A self-edit must never be recorded as a moderation action.
    expect(resolvePostEditAccess({ isAuthor: true, isModerator: true })).toBe("author");
  });

  it("routes a non-author moderator to the moderator edit path", () => {
    expect(resolvePostEditAccess({ isAuthor: false, isModerator: true })).toBe("moderator");
  });

  it("denies a non-author non-moderator", () => {
    expect(resolvePostEditAccess({ isAuthor: false, isModerator: false })).toBe("denied");
  });
});

describe("diffPostEdit", () => {
  const current = {
    title: "Old title",
    content: "Old content",
    isNsfw: false,
    isSpoiler: false,
    flairId: null,
    contentRating: "general",
  };

  it("captures only the fields the patch actually changed", () => {
    const diff = diffPostEdit(current, { title: "New title", isNsfw: true });
    expect(diff.changedFields.sort()).toEqual(["isNsfw", "title"]);
    expect(diff.before).toEqual({ title: "Old title", isNsfw: false });
    expect(diff.after).toEqual({ title: "New title", isNsfw: true });
  });

  it("ignores patch fields whose value is unchanged", () => {
    const diff = diffPostEdit(current, { title: "Old title", content: "Changed" });
    expect(diff.changedFields).toEqual(["content"]);
  });

  it("ignores fields absent from the patch payload", () => {
    const diff = diffPostEdit(current, { content: "Changed" });
    expect(diff.changedFields).toEqual(["content"]);
    expect("title" in diff.before).toBe(false);
  });

  it("normalizes nullish values so a cleared field is recorded as null", () => {
    const diff = diffPostEdit({ ...current, flairId: "flair-1" }, { flairId: null });
    expect(diff.changedFields).toEqual(["flairId"]);
    expect(diff.before).toEqual({ flairId: "flair-1" });
    expect(diff.after).toEqual({ flairId: null });
  });

  it("returns an empty diff for a no-op edit", () => {
    const diff = diffPostEdit(current, {});
    expect(diff.changedFields).toEqual([]);
    expect(diff.before).toEqual({});
    expect(diff.after).toEqual({});
  });
});
