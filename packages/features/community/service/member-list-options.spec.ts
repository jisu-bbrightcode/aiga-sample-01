/**
 * 멤버 목록 필터 파싱 단위 테스트 (PB-COMM-MEMBER-API-001 / BBR-592).
 */
import {
  DEFAULT_MEMBER_LIST_LIMIT,
  MAX_MEMBER_LIST_LIMIT,
  normalizeMemberLimit,
  normalizeMemberPage,
  parseMemberRole,
  parseMemberStatus,
  resolveMemberStatusFilter,
} from "./member-list-options";

describe("parseMemberRole", () => {
  it("accepts known roles", () => {
    expect(parseMemberRole("member")).toBe("member");
    expect(parseMemberRole("owner")).toBe("owner");
  });

  it("drops unknown / empty values to undefined", () => {
    expect(parseMemberRole("superuser")).toBeUndefined();
    expect(parseMemberRole("")).toBeUndefined();
    expect(parseMemberRole(undefined)).toBeUndefined();
    expect(parseMemberRole(null)).toBeUndefined();
  });
});

describe("parseMemberStatus", () => {
  it("accepts known statuses", () => {
    expect(parseMemberStatus("active")).toBe("active");
    expect(parseMemberStatus("banned")).toBe("banned");
    expect(parseMemberStatus("muted")).toBe("muted");
  });

  it("drops unknown values", () => {
    expect(parseMemberStatus("deleted")).toBeUndefined();
    expect(parseMemberStatus(undefined)).toBeUndefined();
  });
});

describe("normalizeMemberLimit / normalizeMemberPage", () => {
  it("defaults and clamps limit", () => {
    expect(normalizeMemberLimit(undefined)).toBe(DEFAULT_MEMBER_LIST_LIMIT);
    expect(normalizeMemberLimit(0)).toBe(DEFAULT_MEMBER_LIST_LIMIT);
    expect(normalizeMemberLimit(10)).toBe(10);
    expect(normalizeMemberLimit(9999)).toBe(MAX_MEMBER_LIST_LIMIT);
  });

  it("defaults page to 1 for invalid input", () => {
    expect(normalizeMemberPage(undefined)).toBe(1);
    expect(normalizeMemberPage(0)).toBe(1);
    expect(normalizeMemberPage(-3)).toBe(1);
    expect(normalizeMemberPage(4)).toBe(4);
  });
});

describe("resolveMemberStatusFilter", () => {
  it("forces public viewers to active regardless of requested status", () => {
    expect(resolveMemberStatusFilter(undefined, false)).toBe("active");
    expect(resolveMemberStatusFilter("banned", false)).toBe("active");
    expect(resolveMemberStatusFilter("muted", false)).toBe("active");
  });

  it("passes the requested status through for operational viewers", () => {
    expect(resolveMemberStatusFilter("banned", true)).toBe("banned");
    expect(resolveMemberStatusFilter("muted", true)).toBe("muted");
    expect(resolveMemberStatusFilter(undefined, true)).toBeUndefined();
  });
});
