import { NotFoundException } from "@nestjs/common";
import { createMockDb } from "../../__test-utils__/mock-db";
import type { UserDirectoryRow } from "../mappers";
import { UserDirectoryService } from "./user-directory.service";

function makeRow(overrides: Partial<UserDirectoryRow> = {}): UserDirectoryRow {
  return {
    profile: {
      id: "u1",
      name: "홍길동",
      email: "hong@example.com",
      handle: "hong",
      bio: null,
      avatar: null,
      authProvider: "kakao",
      isActive: true,
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
      updatedAt: new Date("2026-01-03T00:00:00.000Z"),
      marketingConsentAt: null,
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

describe("UserDirectoryService", () => {
  let db: ReturnType<typeof createMockDb>;
  let service: UserDirectoryService;

  beforeEach(() => {
    db = createMockDb();
    service = new UserDirectoryService(db as never);
  });

  describe("listUsers (public)", () => {
    it("returns only public fields with pagination meta", async () => {
      db._queueResolve("offset", [makeRow()]); // items query terminal
      db._queueResolve("where", [{ count: 1 }]); // count query terminal

      const result = await service.listUsers({
        page: 1,
        limit: 20,
        sort: "recent",
      } as never);

      expect(result).toEqual({
        items: [expect.objectContaining({ id: "u1", handle: "hong", name: "홍길동" })],
        total: 1,
        page: 1,
        limit: 20,
      });
      // sensitive columns never leak through the public list mapper
      expect(result.items[0]).not.toHaveProperty("email");
      expect(result.items[0]).not.toHaveProperty("authProvider");
      expect(result.items[0]).not.toHaveProperty("isActive");
    });

    it("defaults to an empty page with zero total", async () => {
      db._queueResolve("offset", []);
      db._queueResolve("where", []);

      const result = await service.listUsers({
        page: 2,
        limit: 10,
        sort: "name",
      } as never);

      expect(result).toEqual({ items: [], total: 0, page: 2, limit: 10 });
    });
  });

  describe("getByHandle (public)", () => {
    it("returns the public projection for a matching member", async () => {
      db._queueResolve("limit", [makeRow()]);
      const result = await service.getByHandle("hong");
      expect(result.handle).toBe("hong");
      expect(result).not.toHaveProperty("email");
    });

    it("throws NotFound when no active member matches", async () => {
      db._queueResolve("limit", []);
      await expect(service.getByHandle("ghost")).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("getSelf", () => {
    it("returns the caller's own record with self-tier fields", async () => {
      db._queueResolve("limit", [makeRow()]);
      const result = await service.getSelf("u1");
      expect(result.email).toBe("hong@example.com");
      expect(result.authProvider).toBe("kakao");
      // grade is a plain badge, no admin provenance
      expect(result.grade).toEqual({ id: "g1", slug: "verified", name: "인증 회원" });
    });

    it("throws NotFound when the profile is missing", async () => {
      db._queueResolve("limit", []);
      await expect(service.getSelf("missing")).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("listAdminUsers", () => {
    it("returns the full admin projection incl. grade provenance", async () => {
      db._queueResolve("offset", [makeRow()]);
      db._queueResolve("where", [{ count: 1 }]);

      const result = await service.listAdminUsers({
        page: 1,
        limit: 20,
        includeDeleted: false,
        sort: "recent",
      } as never);

      expect(result.total).toBe(1);
      expect(result.items[0]).toMatchObject({
        email: "hong@example.com",
        isActive: true,
        grade: expect.objectContaining({ source: "signup", dailyUsageLimit: 50 }),
      });
    });
  });

  describe("getAdminUser", () => {
    it("returns the full record by profile id", async () => {
      db._queueResolve("limit", [makeRow()]);
      const result = await service.getAdminUser("u1");
      expect(result.email).toBe("hong@example.com");
      expect(result.grade?.source).toBe("signup");
    });

    it("throws NotFound when the user does not exist", async () => {
      db._queueResolve("limit", []);
      await expect(service.getAdminUser("nope")).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
