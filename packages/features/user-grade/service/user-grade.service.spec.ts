import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { createMockDb } from "../../__test-utils__/mock-db";
import type { AssignUserGradeDto, ListUserGradesQueryDto } from "../dto";
import { UserGradeService } from "./user-grade.service";

function makeGradeDef(overrides: Record<string, unknown> = {}) {
  return {
    id: "22222222-2222-2222-2222-222222222222",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    name: "기본 회원",
    slug: "basic",
    description: null,
    sortOrder: 10,
    dailyUsageLimit: 20,
    isSystem: true,
    isActive: true,
    ...overrides,
  };
}

function makeGradeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "33333333-3333-3333-3333-333333333333",
    createdAt: new Date("2026-02-01T00:00:00.000Z"),
    updatedAt: new Date("2026-02-01T00:00:00.000Z"),
    userId: "user-1",
    gradeId: "22222222-2222-2222-2222-222222222222",
    source: "manual",
    determinedBy: "admin-1",
    note: null,
    determinedAt: new Date("2026-02-01T00:00:00.000Z"),
    expiresAt: null,
    ...overrides,
  };
}

function pgError(code: string) {
  return Object.assign(new Error(`pg ${code}`), { code });
}

describe("UserGradeService", () => {
  let db: ReturnType<typeof createMockDb>;
  let service: UserGradeService;

  beforeEach(() => {
    db = createMockDb();
    service = new UserGradeService(db as never);
  });

  describe("assignGrade", () => {
    it("resolves the grade by slug, inserts with default source=manual, returns admin view", async () => {
      const def = makeGradeDef();
      db.query.userGradeDefinitions.findFirst.mockResolvedValue(def);
      const inserted = makeGradeRow();
      db._queueResolve("returning", [inserted]);

      const result = await service.assignGrade("admin-1", "user-1", {
        gradeSlug: "basic",
      } as AssignUserGradeDto);

      expect(result).toEqual(
        expect.objectContaining({
          userId: "user-1",
          gradeId: def.id,
          gradeSlug: "basic",
          gradeName: "기본 회원",
          dailyUsageLimit: 20,
          source: "manual",
          determinedBy: "admin-1",
        }),
      );
      // values() must have stamped source=manual + determinedBy=admin
      const values = (db.values as jest.Mock).mock.calls[0][0];
      expect(values).toEqual(
        expect.objectContaining({ userId: "user-1", gradeId: def.id, source: "manual", determinedBy: "admin-1" }),
      );
    });

    it("honors an explicit source (e.g. identity_verified)", async () => {
      db.query.userGradeDefinitions.findFirst.mockResolvedValue(makeGradeDef());
      db._queueResolve("returning", [makeGradeRow({ source: "identity_verified" })]);

      const result = await service.assignGrade("admin-1", "user-1", {
        gradeSlug: "basic",
        source: "identity_verified",
      } as AssignUserGradeDto);

      expect(result.source).toBe("identity_verified");
      expect((db.values as jest.Mock).mock.calls[0][0]).toEqual(
        expect.objectContaining({ source: "identity_verified" }),
      );
    });

    it("throws NotFound when the grade does not exist", async () => {
      db.query.userGradeDefinitions.findFirst.mockResolvedValue(undefined);
      await expect(
        service.assignGrade("admin-1", "user-1", { gradeSlug: "ghost" } as AssignUserGradeDto),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("throws BadRequest when the grade is inactive", async () => {
      db.query.userGradeDefinitions.findFirst.mockResolvedValue(makeGradeDef({ isActive: false }));
      await expect(
        service.assignGrade("admin-1", "user-1", { gradeSlug: "basic" } as AssignUserGradeDto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("maps a unique violation to 409 Conflict (one grade per user)", async () => {
      db.query.userGradeDefinitions.findFirst.mockResolvedValue(makeGradeDef());
      (db.returning as jest.Mock).mockImplementationOnce(() => Promise.reject(pgError("23505")));
      await expect(
        service.assignGrade("admin-1", "user-1", { gradeSlug: "basic" } as AssignUserGradeDto),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("maps an FK violation to 404 (unknown target user)", async () => {
      db.query.userGradeDefinitions.findFirst.mockResolvedValue(makeGradeDef());
      (db.returning as jest.Mock).mockImplementationOnce(() => Promise.reject(pgError("23503")));
      await expect(
        service.assignGrade("admin-1", "ghost-user", { gradeSlug: "basic" } as AssignUserGradeDto),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("getUserGrade", () => {
    it("throws NotFound when the user has no grade", async () => {
      db.query.userGrades.findFirst.mockResolvedValue(undefined);
      await expect(service.getUserGrade("user-1")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("returns the admin view resolved against the grade definition", async () => {
      db.query.userGrades.findFirst.mockResolvedValue({
        ...makeGradeRow({ note: "VIP" }),
        grade: makeGradeDef({ slug: "verified", name: "인증 회원", dailyUsageLimit: 100 }),
      });

      const result = await service.getUserGrade("user-1");

      expect(result).toEqual(
        expect.objectContaining({
          userId: "user-1",
          gradeSlug: "verified",
          gradeName: "인증 회원",
          dailyUsageLimit: 100,
          note: "VIP",
        }),
      );
    });
  });

  describe("listUserGrades", () => {
    it("returns paginated items mapped to the admin view", async () => {
      db.query.userGrades.findMany.mockResolvedValue([
        { ...makeGradeRow(), grade: makeGradeDef() },
      ]);
      db._queueResolve("where", [{ count: 1 }]);

      const result = await service.listUserGrades({ page: 1, limit: 20 } as ListUserGradesQueryDto);

      expect(result).toEqual({
        items: [expect.objectContaining({ userId: "user-1", gradeSlug: "basic" })],
        total: 1,
        page: 1,
        limit: 20,
      });
    });

    it("returns an empty page (no error) when filtering by an unknown grade slug", async () => {
      db.query.userGradeDefinitions.findFirst.mockResolvedValue(undefined);

      const result = await service.listUserGrades({
        page: 1,
        limit: 20,
        gradeSlug: "ghost",
      } as ListUserGradesQueryDto);

      expect(result).toEqual({ items: [], total: 0, page: 1, limit: 20 });
    });
  });

  describe("ensureSignupGrade", () => {
    it("resolves the default grade and inserts idempotently with source=signup", async () => {
      const def = makeGradeDef();
      db.query.userGradeDefinitions.findFirst.mockResolvedValue(def);

      await service.ensureSignupGrade("user-1");

      // resolved the default 'basic' grade
      expect(db.query.userGradeDefinitions.findFirst).toHaveBeenCalled();
      // inserted with signup provenance, conflict-safe
      expect((db.values as jest.Mock).mock.calls[0][0]).toEqual(
        expect.objectContaining({ userId: "user-1", gradeId: def.id, source: "signup" }),
      );
      expect(db.onConflictDoNothing as jest.Mock).toHaveBeenCalled();
    });
  });
});
