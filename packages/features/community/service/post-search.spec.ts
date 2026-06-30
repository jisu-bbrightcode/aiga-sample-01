import { MAX_POST_SEARCH_LENGTH, normalizePostSearchTerm } from "./post-search";

describe("normalizePostSearchTerm", () => {
  it("returns null for empty / whitespace-only / nullish input", () => {
    expect(normalizePostSearchTerm(undefined)).toBeNull();
    expect(normalizePostSearchTerm(null)).toBeNull();
    expect(normalizePostSearchTerm("")).toBeNull();
    expect(normalizePostSearchTerm("   ")).toBeNull();
  });

  it("trims and wraps the term in ILIKE wildcards", () => {
    expect(normalizePostSearchTerm("  hello  ")).toBe("%hello%");
  });

  it("escapes LIKE metacharacters so they match literally", () => {
    expect(normalizePostSearchTerm("50%")).toBe("%50\\%%");
    expect(normalizePostSearchTerm("a_b")).toBe("%a\\_b%");
    expect(normalizePostSearchTerm("c\\d")).toBe("%c\\\\d%");
  });

  it("caps the term at MAX_POST_SEARCH_LENGTH before wrapping", () => {
    const long = "x".repeat(MAX_POST_SEARCH_LENGTH + 50);
    const result = normalizePostSearchTerm(long);
    // %...% adds 2 chars around the capped (and here un-escaped) term
    expect(result).toBe(`%${"x".repeat(MAX_POST_SEARCH_LENGTH)}%`);
  });

  it("keeps inner whitespace and unicode (Korean) intact", () => {
    expect(normalizePostSearchTerm("의사 추천")).toBe("%의사 추천%");
  });
});
