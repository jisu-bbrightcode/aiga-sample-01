import {
  buildHiddenKeySet,
  hiddenTargetKey,
  isHiddenForViewer,
  partitionHiddenTargets,
} from "./hidden-content";

describe("hidden-content policy helpers", () => {
  describe("hiddenTargetKey", () => {
    it("builds a stable type:id key", () => {
      expect(hiddenTargetKey("post", "p1")).toBe("post:p1");
      expect(hiddenTargetKey("comment", "c1")).toBe("comment:c1");
    });

    it("disambiguates post vs comment with the same id", () => {
      expect(hiddenTargetKey("post", "x")).not.toBe(hiddenTargetKey("comment", "x"));
    });
  });

  describe("partitionHiddenTargets", () => {
    it("splits records into post/comment id buckets", () => {
      const { postIds, commentIds } = partitionHiddenTargets([
        { targetType: "post", targetId: "p1" },
        { targetType: "comment", targetId: "c1" },
        { targetType: "post", targetId: "p2" },
      ]);
      expect(postIds).toEqual(["p1", "p2"]);
      expect(commentIds).toEqual(["c1"]);
    });

    it("dedupes repeated ids within a bucket", () => {
      const { postIds } = partitionHiddenTargets([
        { targetType: "post", targetId: "p1" },
        { targetType: "post", targetId: "p1" },
      ]);
      expect(postIds).toEqual(["p1"]);
    });

    it("returns empty buckets for no records", () => {
      expect(partitionHiddenTargets([])).toEqual({ postIds: [], commentIds: [] });
    });
  });

  describe("buildHiddenKeySet + isHiddenForViewer", () => {
    const keys = buildHiddenKeySet([
      { targetType: "post", targetId: "p1" },
      { targetType: "comment", targetId: "c1" },
    ]);

    it("returns true for a hidden target", () => {
      expect(isHiddenForViewer(keys, "post", "p1")).toBe(true);
      expect(isHiddenForViewer(keys, "comment", "c1")).toBe(true);
    });

    it("returns false for a non-hidden target", () => {
      expect(isHiddenForViewer(keys, "post", "p2")).toBe(false);
      // same id, different type → not hidden
      expect(isHiddenForViewer(keys, "comment", "p1")).toBe(false);
    });

    it("returns false against an empty set", () => {
      expect(isHiddenForViewer(new Set(), "post", "p1")).toBe(false);
    });
  });
});
