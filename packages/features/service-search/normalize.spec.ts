import { normalizeQuery, resolveSortMode } from "./normalize";

describe("normalizeQuery", () => {
  it("lowercases, trims, and collapses internal whitespace", () => {
    expect(normalizeQuery("  강남   정형외과 ")).toBe("강남 정형외과");
    expect(normalizeQuery("Cardio")).toBe("cardio");
    expect(normalizeQuery("a\t\nb")).toBe("a b");
  });
});

describe("resolveSortMode", () => {
  it("defaults to relevance when a query is present", () => {
    expect(resolveSortMode(undefined, true)).toBe("relevance");
  });

  it("defaults to featured for an empty browse (no query)", () => {
    expect(resolveSortMode(undefined, false)).toBe("featured");
  });

  it("downgrades an explicit relevance sort to featured without a query", () => {
    expect(resolveSortMode("relevance", false)).toBe("featured");
    expect(resolveSortMode("relevance", true)).toBe("relevance");
  });

  it("honours explicit rating and featured sorts regardless of query", () => {
    expect(resolveSortMode("rating", false)).toBe("rating");
    expect(resolveSortMode("rating", true)).toBe("rating");
    expect(resolveSortMode("featured", true)).toBe("featured");
  });
});
