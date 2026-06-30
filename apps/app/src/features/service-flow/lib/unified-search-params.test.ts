import { describe, expect, it } from "vitest";
import {
  DEFAULT_UNIFIED_SORT,
  hasActiveSearch,
  parseUnifiedSearch,
  toUnifiedSearchParams,
  toUnifiedSearchUrl,
  type UnifiedSearchFilters,
} from "./unified-search-params";

describe("parseUnifiedSearch", () => {
  it("normalizes keyword and entity-type, trimming and dropping empties", () => {
    const filters = parseUnifiedSearch({ q: "  내과 ", type: "hospital", sort: "rating" });
    expect(filters).toEqual({ q: "내과", type: "hospital", sort: "rating" });
  });

  it("falls back to the default sort for missing or unknown values", () => {
    expect(parseUnifiedSearch(undefined).sort).toBe(DEFAULT_UNIFIED_SORT);
    expect(parseUnifiedSearch({ sort: "bogus" }).sort).toBe(DEFAULT_UNIFIED_SORT);
    expect(parseUnifiedSearch({ sort: 42 }).sort).toBe(DEFAULT_UNIFIED_SORT);
    // `featured` is a server sort but not a UI option → treated as default.
    expect(parseUnifiedSearch({ sort: "featured" }).sort).toBe(DEFAULT_UNIFIED_SORT);
  });

  it("drops an unknown entity-type to 전체 (undefined)", () => {
    expect(parseUnifiedSearch({ type: "doctor" }).type).toBe("doctor");
    expect(parseUnifiedSearch({ type: "clinic" }).type).toBeUndefined();
    expect(parseUnifiedSearch({ type: 7 }).type).toBeUndefined();
  });

  it("ignores non-string fields without throwing", () => {
    expect(parseUnifiedSearch({ q: 123, type: null, sort: {} })).toEqual({
      q: undefined,
      type: undefined,
      sort: DEFAULT_UNIFIED_SORT,
    });
  });
});

describe("toUnifiedSearchUrl", () => {
  it("omits empty values and the default sort for a clean address bar", () => {
    const filters: UnifiedSearchFilters = { sort: DEFAULT_UNIFIED_SORT };
    expect(toUnifiedSearchUrl(filters)).toEqual({
      q: undefined,
      type: undefined,
      sort: undefined,
    });
  });

  it("keeps a non-default sort and active filters", () => {
    const filters: UnifiedSearchFilters = { q: "치과", type: "doctor", sort: "rating" };
    expect(toUnifiedSearchUrl(filters)).toEqual({ q: "치과", type: "doctor", sort: "rating" });
  });

  it("round-trips through parseUnifiedSearch", () => {
    const filters: UnifiedSearchFilters = { q: "피부과", type: "specialty", sort: "rating" };
    expect(parseUnifiedSearch(toUnifiedSearchUrl(filters) as never)).toEqual(filters);
  });
});

describe("toUnifiedSearchParams", () => {
  it("maps filters to the server query with a default limit", () => {
    expect(toUnifiedSearchParams({ q: "내과", type: "hospital", sort: "rating" })).toEqual({
      q: "내과",
      type: "hospital",
      sort: "rating",
      limit: 20,
    });
  });

  it("honors a custom limit", () => {
    expect(toUnifiedSearchParams({ sort: "relevance" }, 5).limit).toBe(5);
  });
});

describe("hasActiveSearch", () => {
  it("is false for the empty default and true once narrowed", () => {
    expect(hasActiveSearch({ sort: DEFAULT_UNIFIED_SORT })).toBe(false);
    expect(hasActiveSearch({ q: "내과", sort: DEFAULT_UNIFIED_SORT })).toBe(true);
    expect(hasActiveSearch({ type: "doctor", sort: DEFAULT_UNIFIED_SORT })).toBe(true);
  });
});
