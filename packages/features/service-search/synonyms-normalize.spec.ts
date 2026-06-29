import { normalizeExpansions, normalizeSynonymTerm } from "./synonyms-normalize";

describe("normalizeSynonymTerm", () => {
  it("trims, lowercases, and collapses internal whitespace", () => {
    expect(normalizeSynonymTerm("  Ortho   Clinic ")).toBe("ortho clinic");
  });
});

describe("normalizeExpansions", () => {
  it("cleans, de-duplicates, and preserves first-seen order", () => {
    expect(normalizeExpansions(["뼈", " 관절 ", "뼈", ""], "정형외과")).toEqual(["뼈", "관절"]);
  });

  it("drops any expansion equal to the canonical term", () => {
    expect(normalizeExpansions(["정형외과", "뼈"], "정형외과")).toEqual(["뼈"]);
  });

  it("returns an empty array when nothing survives cleaning", () => {
    expect(normalizeExpansions(["", "  ", "정형외과"], "정형외과")).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const input = [" 뼈 ", "관절"];
    const snapshot = [...input];
    normalizeExpansions(input, "정형외과");
    expect(input).toEqual(snapshot);
  });
});
