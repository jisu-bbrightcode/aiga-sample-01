import { toAdminUser, toPublicUser, toSelfUser, type UserDirectoryRow } from "./mappers";

function makeRow(overrides: Partial<UserDirectoryRow> = {}): UserDirectoryRow {
  return {
    profile: {
      id: "u1",
      name: "홍길동",
      email: "hong@example.com",
      handle: "hong",
      bio: "소개글",
      avatar: "https://cdn/avatar.png",
      authProvider: "kakao",
      isActive: true,
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
      updatedAt: new Date("2026-01-03T00:00:00.000Z"),
      marketingConsentAt: new Date("2026-01-02T00:00:00.000Z"),
      deletedAt: null,
    } as UserDirectoryRow["profile"],
    gradeId: "g1",
    gradeSlug: "verified",
    gradeName: "인증 회원",
    gradeDailyUsageLimit: 50,
    gradeSource: "signup",
    gradeDeterminedAt: new Date("2026-01-02T00:00:00.000Z"),
    gradeExpiresAt: null,
    ...overrides,
  };
}

describe("user-directory mappers", () => {
  describe("toPublicUser", () => {
    it("exposes only the public directory fields", () => {
      const result = toPublicUser(makeRow());
      expect(result).toEqual({
        id: "u1",
        handle: "hong",
        name: "홍길동",
        bio: "소개글",
        avatar: "https://cdn/avatar.png",
        grade: { id: "g1", slug: "verified", name: "인증 회원" },
        joinedAt: "2026-01-02T00:00:00.000Z",
      });
    });

    it("never leaks email / auth provider / active flag / soft-delete bookkeeping", () => {
      const result = toPublicUser(makeRow());
      for (const leaked of [
        "email",
        "authProvider",
        "isActive",
        "marketingConsentAt",
        "updatedAt",
        "deletedAt",
      ]) {
        expect(result).not.toHaveProperty(leaked);
      }
    });

    it("returns grade null when the user has no grade row yet", () => {
      const result = toPublicUser(makeRow({ gradeId: null, gradeSlug: null, gradeName: null }));
      expect(result.grade).toBeNull();
    });
  });

  describe("toSelfUser", () => {
    it("adds the self-tier private fields but not admin-only grade provenance", () => {
      const result = toSelfUser(makeRow());
      expect(result.email).toBe("hong@example.com");
      expect(result.authProvider).toBe("kakao");
      expect(result.isActive).toBe(true);
      expect(result.marketingConsentAt).toBe("2026-01-02T00:00:00.000Z");
      expect(result.updatedAt).toBe("2026-01-03T00:00:00.000Z");
      // grade stays a plain badge — no source/limit/expiry for self.
      expect(result.grade).toEqual({ id: "g1", slug: "verified", name: "인증 회원" });
      expect(result).not.toHaveProperty("deletedAt");
    });
  });

  describe("toAdminUser", () => {
    it("exposes the full record incl. grade provenance, quota and soft-delete", () => {
      const result = toAdminUser(
        makeRow({
          profile: {
            ...makeRow().profile,
            deletedAt: new Date("2026-02-01T00:00:00.000Z"),
          },
        }),
      );
      expect(result.email).toBe("hong@example.com");
      expect(result.deletedAt).toBe("2026-02-01T00:00:00.000Z");
      expect(result.grade).toEqual({
        id: "g1",
        slug: "verified",
        name: "인증 회원",
        dailyUsageLimit: 50,
        source: "signup",
        determinedAt: "2026-01-02T00:00:00.000Z",
        expiresAt: null,
      });
    });

    it("returns grade null when unassigned", () => {
      const result = toAdminUser(makeRow({ gradeId: null, gradeSlug: null, gradeName: null }));
      expect(result.grade).toBeNull();
    });
  });
});
