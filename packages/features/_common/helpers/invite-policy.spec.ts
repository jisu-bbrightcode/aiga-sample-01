import {
  INVITATION_TTL_MS,
  inviteExpiresAt,
  isInvitableRole,
  normalizeInviteEmail,
} from "./invite-policy";

describe("isInvitableRole", () => {
  it("accepts admin and member", () => {
    expect(isInvitableRole("admin")).toBe(true);
    expect(isInvitableRole("member")).toBe(true);
  });

  it("rejects owner and unknown roles (AC: 잘못된 role 차단)", () => {
    expect(isInvitableRole("owner")).toBe(false);
    expect(isInvitableRole("superuser")).toBe(false);
    expect(isInvitableRole("")).toBe(false);
    expect(isInvitableRole(undefined)).toBe(false);
    expect(isInvitableRole(123)).toBe(false);
  });
});

describe("normalizeInviteEmail", () => {
  it("trims and lowercases a valid email", () => {
    expect(normalizeInviteEmail("  Operator@Example.COM ")).toBe("operator@example.com");
  });

  it("returns null for malformed or missing values (AC: 잘못된 입력 차단)", () => {
    expect(normalizeInviteEmail("not-an-email")).toBeNull();
    expect(normalizeInviteEmail("missing@domain")).toBeNull();
    expect(normalizeInviteEmail("@example.com")).toBeNull();
    expect(normalizeInviteEmail("a b@example.com")).toBeNull();
    expect(normalizeInviteEmail("")).toBeNull();
    expect(normalizeInviteEmail(null)).toBeNull();
    expect(normalizeInviteEmail(42)).toBeNull();
  });
});

describe("inviteExpiresAt", () => {
  it("adds the TTL to the reference time", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    expect(inviteExpiresAt(now).getTime()).toBe(now.getTime() + INVITATION_TTL_MS);
  });
});
