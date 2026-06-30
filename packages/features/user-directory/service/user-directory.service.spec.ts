import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { createMockDb } from "../../__test-utils__/mock-db";
import { SessionRevocationService } from "../../_common/service/session-revocation.service";
import type { UserDirectoryRow } from "../mappers";
import { UserDirectoryService } from "./user-directory.service";

type ProfileRow = UserDirectoryRow["profile"];

function makeProfile(overrides: Partial<ProfileRow> = {}): ProfileRow {
  return {
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
    ...overrides,
  } as ProfileRow;
}

function makeRow(overrides: Partial<UserDirectoryRow> = {}): UserDirectoryRow {
  return {
    profile: makeProfile(),
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
  let audit: { log: jest.Mock; list: jest.Mock };
  let service: UserDirectoryService;

  beforeEach(() => {
    db = createMockDb();
    audit = { log: jest.fn(), list: jest.fn() };
    const sessionRevocation = new SessionRevocationService(db as never);
    service = new UserDirectoryService(db as never, audit as never, sessionRevocation as never);
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

  describe("getByHandle (public, viewer-aware)", () => {
    it("returns the public projection + anonymous viewer state for an active member", async () => {
      db._queueResolve("limit", [makeRow()]);
      const result = await service.getByHandle("hong");
      expect(result.handle).toBe("hong");
      expect(result).not.toHaveProperty("email");
      expect(result.viewer).toEqual({ authenticated: false, isSelf: false });
    });

    it("marks an authenticated non-owner as authenticated but not self", async () => {
      db._queueResolve("limit", [makeRow()]);
      const result = await service.getByHandle("hong", { id: "someone-else" });
      expect(result.viewer).toEqual({ authenticated: true, isSelf: false });
    });

    it("marks the owner viewing their own handle as isSelf", async () => {
      db._queueResolve("limit", [makeRow()]);
      const result = await service.getByHandle("hong", { id: "u1" });
      expect(result.viewer).toEqual({ authenticated: true, isSelf: true });
    });

    it("throws NotFound when no profile matches the handle", async () => {
      db._queueResolve("limit", []);
      await expect(service.getByHandle("ghost")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("hides a soft-deleted profile as 404 even from an authenticated viewer", async () => {
      db._queueResolve("limit", [makeRow({ profile: makeProfile({ deletedAt: new Date() }) })]);
      await expect(service.getByHandle("hong", { id: "other" })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("returns 403 to an authenticated non-owner for a deactivated profile", async () => {
      db._queueResolve("limit", [makeRow({ profile: makeProfile({ isActive: false }) })]);
      await expect(service.getByHandle("hong", { id: "other" })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it("returns 404 (not 403) to an anonymous viewer for a deactivated profile", async () => {
      db._queueResolve("limit", [makeRow({ profile: makeProfile({ isActive: false }) })]);
      await expect(service.getByHandle("hong")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("lets the owner see their own deactivated profile", async () => {
      db._queueResolve("limit", [makeRow({ profile: makeProfile({ isActive: false }) })]);
      const result = await service.getByHandle("hong", { id: "u1" });
      expect(result.viewer).toEqual({ authenticated: true, isSelf: true });
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

  describe("archiveUser (soft delete)", () => {
    it("archives an active user, revokes its sessions, and records an audit entry", async () => {
      db._queueResolve("limit", [makeRow()]);
      db._queueResolve("returning", [{ id: "sess-1" }, { id: "sess-2" }]); // revoked sessions

      const result = await service.archiveUser({
        id: "u1",
        actorUserId: "admin1",
        reason: "스팸 계정",
        ipAddress: "10.0.0.1",
        userAgent: "jest",
      });

      // soft delete: record is flagged, not removed
      expect(result.isActive).toBe(false);
      expect(result.deletedAt).not.toBeNull();
      expect(db.update).toHaveBeenCalledTimes(1);
      // archiving signs the user out everywhere (AC: 세션·권한 일관 정리)
      expect(db.delete).toHaveBeenCalledTimes(1);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "user.archived",
          actorUserId: "admin1",
          targetType: "user",
          targetId: "u1",
          reason: "스팸 계정",
          payloadAfter: expect.objectContaining({ revokedSessions: 2 }),
        }),
      );
    });

    it("is idempotent for an already-archived user (no write, no audit)", async () => {
      db._queueResolve("limit", [
        makeRow({ profile: makeProfile({ deletedAt: new Date("2026-02-01T00:00:00.000Z") }) }),
      ]);

      const result = await service.archiveUser({ id: "u1", actorUserId: "admin1" });

      expect(result.deletedAt).toBe("2026-02-01T00:00:00.000Z");
      expect(db.update).not.toHaveBeenCalled();
      expect(audit.log).not.toHaveBeenCalled();
    });

    it("throws NotFound when archiving a missing user", async () => {
      db._queueResolve("limit", []);
      await expect(
        service.archiveUser({ id: "ghost", actorUserId: "admin1" }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(audit.log).not.toHaveBeenCalled();
    });
  });

  describe("restoreUser", () => {
    it("restores an archived user and records an audit entry", async () => {
      db._queueResolve("limit", [
        makeRow({ profile: makeProfile({ deletedAt: new Date(), isActive: false }) }),
      ]);

      const result = await service.restoreUser({ id: "u1", actorUserId: "admin1" });

      expect(result.isActive).toBe(true);
      expect(result.deletedAt).toBeNull();
      expect(db.update).toHaveBeenCalledTimes(1);
      // restore does not recreate sessions — the user signs in again
      expect(db.delete).not.toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "user.restored",
          actorUserId: "admin1",
          targetType: "user",
          targetId: "u1",
        }),
      );
    });

    it("is idempotent when the user is not archived (no write, no audit)", async () => {
      db._queueResolve("limit", [makeRow()]);

      const result = await service.restoreUser({ id: "u1", actorUserId: "admin1" });

      expect(result.deletedAt).toBeNull();
      expect(db.update).not.toHaveBeenCalled();
      expect(audit.log).not.toHaveBeenCalled();
    });

    it("throws NotFound when restoring a missing user", async () => {
      db._queueResolve("limit", []);
      await expect(
        service.restoreUser({ id: "ghost", actorUserId: "admin1" }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(audit.log).not.toHaveBeenCalled();
    });
  });

  describe("updateAdminUser (부분 수정)", () => {
    it("updates allowed fields and records a user.updated audit with before/after", async () => {
      db._queueResolve("limit", [makeRow()]);

      const result = await service.updateAdminUser({
        id: "u1",
        actorUserId: "admin1",
        name: "임꺽정",
        bio: "소개글",
        reason: "운영자 정정",
      });

      expect(result.name).toBe("임꺽정");
      expect(result.bio).toBe("소개글");
      expect(db.update).toHaveBeenCalledTimes(1);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "user.updated",
          actorUserId: "admin1",
          targetType: "user",
          targetId: "u1",
          payloadBefore: expect.objectContaining({ name: "홍길동" }),
          payloadAfter: expect.objectContaining({ name: "임꺽정", bio: "소개글" }),
        }),
      );
    });

    it("clears a nullable field when explicitly set to null", async () => {
      db._queueResolve("limit", [makeRow({ profile: makeProfile({ bio: "old" }) })]);

      const result = await service.updateAdminUser({
        id: "u1",
        actorUserId: "admin1",
        bio: null,
      });

      expect(result.bio).toBeNull();
      expect(db.update).toHaveBeenCalledTimes(1);
    });

    it("throws BadRequest when no editable field is provided (no read/write/audit)", async () => {
      await expect(
        service.updateAdminUser({ id: "u1", actorUserId: "admin1", reason: "noop" }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(db.select).not.toHaveBeenCalled();
      expect(audit.log).not.toHaveBeenCalled();
    });

    it("throws NotFound for a missing user", async () => {
      db._queueResolve("limit", []);
      await expect(
        service.updateAdminUser({ id: "ghost", actorUserId: "admin1", name: "x" }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(audit.log).not.toHaveBeenCalled();
    });

    it("maps a handle unique-violation to 409 Conflict", async () => {
      db._queueResolve("limit", [makeRow()]);
      (db.update as jest.Mock).mockImplementationOnce(() => {
        throw Object.assign(new Error("duplicate key"), { code: "23505" });
      });

      await expect(
        service.updateAdminUser({ id: "u1", actorUserId: "admin1", handle: "taken" }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(audit.log).not.toHaveBeenCalled();
    });
  });

  describe("getUserHistory (변경 이력)", () => {
    it("delegates to the audit log scoped to this user", async () => {
      audit.list.mockResolvedValue({ rows: [], nextCursor: null });

      const result = await service.getUserHistory("u1", { cursor: "100", limit: 25 });

      expect(audit.list).toHaveBeenCalledWith({
        targetType: "user",
        targetId: "u1",
        cursor: "100",
        limit: 25,
      });
      expect(result).toEqual({ rows: [], nextCursor: null });
    });
  });
});
