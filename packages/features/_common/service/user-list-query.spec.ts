import {
  DEFAULT_USER_LIST_LIMIT,
  DEFAULT_USER_SORT,
  DEFAULT_USER_SORT_ORDER,
  MAX_USER_LIST_LIMIT,
  normalizeUserListQuery,
} from "./user-list-query";

describe("normalizeUserListQuery", () => {
  it("applies defaults for an empty query", () => {
    expect(normalizeUserListQuery({})).toEqual({
      limit: DEFAULT_USER_LIST_LIMIT,
      offset: 0,
      q: undefined,
      status: undefined,
      accessRole: undefined,
      sort: DEFAULT_USER_SORT,
      order: DEFAULT_USER_SORT_ORDER,
    });
  });

  it("clamps limit to [1, MAX] and floors offset at 0", () => {
    expect(normalizeUserListQuery({ limit: "0", offset: "-5" }).limit).toBe(1);
    expect(normalizeUserListQuery({ limit: "9999" }).limit).toBe(MAX_USER_LIST_LIMIT);
    expect(normalizeUserListQuery({ offset: "-5" }).offset).toBe(0);
    expect(normalizeUserListQuery({ limit: "abc" }).limit).toBe(DEFAULT_USER_LIST_LIMIT);
  });

  it("trims search and drops empty strings", () => {
    expect(normalizeUserListQuery({ q: "  jane  " }).q).toBe("jane");
    expect(normalizeUserListQuery({ q: "   " }).q).toBeUndefined();
  });

  it("accepts valid status / accessRole filters", () => {
    expect(normalizeUserListQuery({ status: "inactive" }).status).toBe("inactive");
    expect(normalizeUserListQuery({ accessRole: "none" }).accessRole).toBe("none");
    expect(normalizeUserListQuery({ accessRole: "admin" }).accessRole).toBe("admin");
  });

  it("ignores unknown filter values (degrade, never 400)", () => {
    expect(normalizeUserListQuery({ status: "banned" }).status).toBeUndefined();
    expect(normalizeUserListQuery({ accessRole: "superuser" }).accessRole).toBeUndefined();
  });

  it("accepts valid sort fields and order, falling back otherwise", () => {
    expect(normalizeUserListQuery({ sort: "lastActiveAt", order: "asc" })).toMatchObject({
      sort: "lastActiveAt",
      order: "asc",
    });
    expect(normalizeUserListQuery({ sort: "email" }).sort).toBe(DEFAULT_USER_SORT);
    expect(normalizeUserListQuery({ order: "sideways" }).order).toBe(DEFAULT_USER_SORT_ORDER);
  });
});
