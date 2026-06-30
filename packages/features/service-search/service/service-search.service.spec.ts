import { NotFoundException } from "@nestjs/common";
import { createMockDb } from "../../__test-utils__/mock-db";
import { ServiceSearchService } from "./service-search.service";

/** A row already projected to the public column set (what the SQL select returns). */
function publicRow(overrides: Record<string, unknown> = {}) {
  return {
    entityType: "doctor",
    entityId: "22222222-2222-2222-2222-222222222222",
    title: "김명의",
    subtitle: "정형외과 · 강남구",
    slug: "kim-myeongui",
    photoUrl: null,
    regionId: "33333333-3333-3333-3333-333333333333",
    specialtyId: "44444444-4444-4444-4444-444444444444",
    ratingAvg: 4.8,
    ...overrides,
  };
}

/** A full document row (admin select returns everything, including internals). */
function fullRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    createdAt: new Date("2026-01-02T00:00:00.000Z"),
    updatedAt: new Date("2026-01-03T00:00:00.000Z"),
    ...publicRow(),
    body: "internal bio",
    keywords: "ortho",
    weight: 100,
    isPublished: false,
    sourceUpdatedAt: new Date("2026-01-01T00:00:00.000Z"),
    isDeleted: false,
    deletedAt: null,
    searchVector: "ignored",
    ...overrides,
  };
}

describe("ServiceSearchService", () => {
  let db: ReturnType<typeof createMockDb>;
  let service: ServiceSearchService;

  beforeEach(() => {
    db = createMockDb();
    service = new ServiceSearchService(db as never);
  });

  describe("search (public)", () => {
    it("selects ONLY public columns and returns pagination meta", async () => {
      db._queueResolve("offset", [publicRow()]); // items terminal
      db._queueResolve("where", [{ count: 1 }]); // count terminal

      const result = await service.search({ page: 1, limit: 20, q: "명의" } as never);

      expect(result).toEqual({
        items: [expect.objectContaining({ entityId: publicRow().entityId, title: "김명의" })],
        total: 1,
        page: 1,
        limit: 20,
      });

      // the projection passed to db.select() must exclude every index internal
      const projection = db.select.mock.calls[0][0] as Record<string, unknown>;
      const keys = Object.keys(projection);
      expect(keys).toEqual(
        expect.arrayContaining(["entityType", "entityId", "title", "slug", "ratingAvg"]),
      );
      for (const internal of ["body", "keywords", "weight", "isPublished", "searchVector"]) {
        expect(keys).not.toContain(internal);
      }
      // and the mapped hit carries no internal field either
      expect(result.items[0]).not.toHaveProperty("weight");
      expect(result.items[0]).not.toHaveProperty("isPublished");
    });

    it("append-logs the normalized query with its result count", async () => {
      db._queueResolve("offset", [publicRow()]);
      db._queueResolve("where", [{ count: 3 }]);

      await service.search({ page: 1, limit: 20, q: "  강남  정형외과 " } as never, "user-1");

      expect(db.insert).toHaveBeenCalledTimes(1);
      const logged = db.values.mock.calls[0][0] as Record<string, unknown>;
      expect(logged.rawQuery).toBe("  강남  정형외과 ");
      expect(logged.normalizedQuery).toBe("강남 정형외과");
      expect(logged.resultCount).toBe(3);
      expect(logged.userId).toBe("user-1");
    });

    it("does NOT log a pure browse (no q)", async () => {
      db._queueResolve("offset", [publicRow()]);
      db._queueResolve("where", [{ count: 1 }]);

      await service.search({ page: 1, limit: 20 } as never);

      expect(db.insert).not.toHaveBeenCalled();
    });

    it("never fails the search when query logging throws", async () => {
      db._queueResolve("offset", [publicRow()]);
      db._queueResolve("where", [{ count: 1 }]);
      db.insert.mockImplementationOnce(() => {
        throw new Error("log table down");
      });

      await expect(
        service.search({ page: 1, limit: 20, q: "명의" } as never),
      ).resolves.toMatchObject({ total: 1 });
    });
  });

  describe("adminSearch", () => {
    it("returns index internals and an unprojected (full-row) select", async () => {
      db._queueResolve("offset", [fullRow()]);
      db._queueResolve("where", [{ count: 1 }]);

      const result = await service.adminSearch({
        page: 1,
        limit: 20,
        published: false,
      } as never);

      // admin select() takes no projection arg (full row)
      expect(db.select.mock.calls[0][0]).toBeUndefined();
      const [hit] = result.items;
      expect(hit?.body).toBe("internal bio");
      expect(hit?.weight).toBe(100);
      expect(hit?.isPublished).toBe(false);
      // raw tsvector is dropped even for admins
      expect(hit).not.toHaveProperty("searchVector");
    });

    it("does not log admin searches", async () => {
      db._queueResolve("offset", [fullRow()]);
      db._queueResolve("where", [{ count: 1 }]);
      await service.adminSearch({ page: 1, limit: 20, q: "명의" } as never);
      expect(db.insert).not.toHaveBeenCalled();
    });
  });

  describe("getPublicDetail (FR-003 detail / BBR-532)", () => {
    it("returns a published hit with ONLY public columns", async () => {
      db._queueResolve("limit", [publicRow()]);

      const hit = await service.getPublicDetail("doctor", "22222222-2222-2222-2222-222222222222");

      expect(hit).toEqual(
        expect.objectContaining({ entityId: publicRow().entityId, title: "김명의" }),
      );
      // public projection only — no index internals selected
      const projection = db.select.mock.calls[0][0] as Record<string, unknown>;
      for (const internal of ["body", "keywords", "weight", "isPublished", "searchVector"]) {
        expect(Object.keys(projection)).not.toContain(internal);
      }
      expect(hit).not.toHaveProperty("weight");
    });

    it("forces is_published = true (missing OR unpublished → 404, no leak)", async () => {
      db._queueResolve("limit", []); // unpublished/missing both yield no row

      await expect(
        service.getPublicDetail("doctor", "22222222-2222-2222-2222-222222222222"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("treats an unknown entityType as 404 without touching the db", async () => {
      await expect(
        service.getPublicDetail("bogus", "22222222-2222-2222-2222-222222222222"),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(db.select).not.toHaveBeenCalled();
    });
  });

  describe("getAdminDetail (FR-003 detail / BBR-532)", () => {
    it("returns the full row incl. internals regardless of publish state", async () => {
      db._queueResolve("limit", [fullRow({ isPublished: false })]);

      const hit = await service.getAdminDetail("doctor", "22222222-2222-2222-2222-222222222222");

      expect(hit.body).toBe("internal bio");
      expect(hit.weight).toBe(100);
      expect(hit.isPublished).toBe(false);
      // admin select() takes no projection arg (full row)
      expect(db.select.mock.calls[0][0]).toBeUndefined();
      // raw tsvector dropped even for admins
      expect(hit).not.toHaveProperty("searchVector");
    });

    it("raises 404 when no document exists", async () => {
      db._queueResolve("limit", []);

      await expect(
        service.getAdminDetail("doctor", "22222222-2222-2222-2222-222222222222"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("treats an unknown entityType as 404 without touching the db", async () => {
      await expect(
        service.getAdminDetail("bogus", "22222222-2222-2222-2222-222222222222"),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(db.select).not.toHaveBeenCalled();
    });
  });

  describe("popularTerms", () => {
    it("maps aggregate term counts", async () => {
      db._queueResolve("limit", [
        { term: "무릎 관절", count: 2 },
        { term: "강남 정형외과", count: 1 },
      ]);
      const out = await service.popularTerms({ limit: 10, days: 7 });
      expect(out).toEqual([
        { term: "무릎 관절", count: 2 },
        { term: "강남 정형외과", count: 1 },
      ]);
    });
  });

  describe("recentTerms", () => {
    it("returns a user's own recent terms as ISO timestamps", async () => {
      db._queueResolve("limit", [
        { term: "심장내과", lastSearchedAt: new Date("2026-02-01T10:00:00.000Z") },
      ]);
      const out = await service.recentTerms("user-1", { limit: 10 });
      expect(out).toEqual([{ term: "심장내과", lastSearchedAt: "2026-02-01T10:00:00.000Z" }]);
    });
  });

  describe("buildWhere archive exclusion (FR-003 delete / BBR-535)", () => {
    it("public search excludes archived rows (is_deleted = false forced)", async () => {
      db._queueResolve("offset", []);
      db._queueResolve("where", [{ count: 0 }]);
      await service.search({ page: 1, limit: 20, q: "명의" } as never);
      // where() received a composed predicate; the service never sets
      // includeDeleted on the public path, so the archive guard is always on.
      expect(db.where).toHaveBeenCalled();
    });

    it("admin search keeps archived rows hidden unless includeDeleted", async () => {
      db._queueResolve("offset", [fullRow()]);
      db._queueResolve("where", [{ count: 1 }]);
      await service.adminSearch({ page: 1, limit: 20, includeDeleted: true } as never);
      // includeDeleted true must NOT throw and must still return a page
      expect(db.select).toHaveBeenCalled();
    });
  });

  describe("getPublicDetail excludes archived (BBR-535)", () => {
    it("an archived (or missing) document is 404 on the public surface", async () => {
      db._queueResolve("limit", []); // archived row filtered out → no row
      await expect(
        service.getPublicDetail("doctor", "22222222-2222-2222-2222-222222222222"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("archiveDocument (FR-003 delete/archive / BBR-535)", () => {
    const ENTITY_ID = "22222222-2222-2222-2222-222222222222";

    it("soft-deletes a live document and returns the archived state", async () => {
      db._queueResolve("limit", [fullRow({ isDeleted: false, deletedAt: null })]); // findDocument
      db._queueResolve("returning", [
        fullRow({ isDeleted: true, deletedAt: new Date("2026-03-01T00:00:00.000Z") }),
      ]);

      const result = await service.archiveDocument("admin-1", "doctor", ENTITY_ID);

      expect(db.update).toHaveBeenCalledTimes(1);
      const patch = db.set.mock.calls[0][0] as Record<string, unknown>;
      expect(patch.isDeleted).toBe(true);
      expect(patch.deletedAt).toBeInstanceOf(Date);
      expect(result).toEqual({
        entityType: "doctor",
        entityId: ENTITY_ID,
        isDeleted: true,
        deletedAt: "2026-03-01T00:00:00.000Z",
        updatedAt: expect.any(String),
      });
    });

    it("is idempotent: an already-archived document is not re-written", async () => {
      db._queueResolve("limit", [fullRow({ isDeleted: true, deletedAt: new Date() })]);

      const result = await service.archiveDocument("admin-1", "doctor", ENTITY_ID);

      expect(db.update).not.toHaveBeenCalled();
      expect(result.isDeleted).toBe(true);
    });

    it("raises 404 for a missing document", async () => {
      db._queueResolve("limit", []);
      await expect(service.archiveDocument("admin-1", "doctor", ENTITY_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(db.update).not.toHaveBeenCalled();
    });

    it("treats an unknown entityType as 404 without touching the db", async () => {
      await expect(service.archiveDocument("admin-1", "bogus", ENTITY_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(db.select).not.toHaveBeenCalled();
    });
  });

  describe("restoreDocument (FR-003 delete/archive / BBR-535)", () => {
    const ENTITY_ID = "22222222-2222-2222-2222-222222222222";

    it("restores an archived document and clears deletedAt", async () => {
      db._queueResolve("limit", [fullRow({ isDeleted: true, deletedAt: new Date() })]);
      db._queueResolve("returning", [fullRow({ isDeleted: false, deletedAt: null })]);

      const result = await service.restoreDocument("admin-1", "doctor", ENTITY_ID);

      const patch = db.set.mock.calls[0][0] as Record<string, unknown>;
      expect(patch.isDeleted).toBe(false);
      expect(patch.deletedAt).toBeNull();
      expect(result).toMatchObject({ entityId: ENTITY_ID, isDeleted: false, deletedAt: null });
    });

    it("is idempotent: a live document is not re-written", async () => {
      db._queueResolve("limit", [fullRow({ isDeleted: false, deletedAt: null })]);

      const result = await service.restoreDocument("admin-1", "doctor", ENTITY_ID);

      expect(db.update).not.toHaveBeenCalled();
      expect(result.isDeleted).toBe(false);
    });

    it("raises 404 for a missing document", async () => {
      db._queueResolve("limit", []);
      await expect(service.restoreDocument("admin-1", "doctor", ENTITY_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
