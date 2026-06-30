import { NotFoundException } from "@nestjs/common";
import { createMockDb } from "../../__test-utils__/mock-db";
import { DoctorCurationService } from "./doctor-curation.service";

const ACTOR = "actor-1";
const ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

function makeCollectionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ID,
    createdAt: new Date("2026-02-01T00:00:00.000Z"),
    updatedAt: new Date("2026-02-02T00:00:00.000Z"),
    deletedAt: null,
    isDeleted: false,
    name: "2026 무릎관절 명의",
    slug: "2026-knee-joint",
    subtitle: null,
    description: null,
    heroImageUrl: null,
    kind: "editorial",
    specialtyId: null,
    regionId: null,
    isFeatured: false,
    sortOrder: 0,
    status: "published",
    internalNotes: null,
    sourceUrl: null,
    publishedAt: new Date("2026-02-01T00:00:00.000Z"),
    createdBy: ACTOR,
    updatedBy: ACTOR,
    ...overrides,
  };
}

function makeItemRow(overrides: Record<string, unknown> = {}) {
  return {
    collectionId: ID,
    doctorId: "dddddddd-dddd-dddd-dddd-dddddddddddd",
    rank: 0,
    note: "선정 이유",
    createdAt: new Date("2026-02-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("DoctorCurationService — lifecycle (archive / delete / restore)", () => {
  let db: ReturnType<typeof createMockDb>;
  let service: DoctorCurationService;

  beforeEach(() => {
    db = createMockDb();
    service = new DoctorCurationService(db as never, { log: jest.fn() } as never);
  });

  // -- archive ---------------------------------------------------------------

  describe("archiveCollection", () => {
    it("sets status=archived and stamps the actor, preserving 수록 의사", async () => {
      const active = makeCollectionRow({ status: "published" });
      const archived = makeCollectionRow({ status: "archived" });
      const item = makeItemRow();
      db._queueResolve("limit", [active]); // requireCollection (active only)
      db._queueResolve("returning", [archived]); // updateCollection
      db._queueResolve("orderBy", [item]); // adminDetailResponse items

      const result = await service.archiveCollection(ACTOR, ID);

      expect(result.status).toBe("archived");
      // 연결 데이터(수록 의사) 보존 — 응답에 그대로 실린다
      expect(result.items).toEqual([
        expect.objectContaining({ doctorId: item.doctorId, note: "선정 이유" }),
      ]);
      const patch = db.set.mock.calls[0][0];
      expect(patch).toEqual(expect.objectContaining({ status: "archived", updatedBy: ACTOR }));
    });

    it("is idempotent when already archived (no second write)", async () => {
      const archived = makeCollectionRow({ status: "archived" });
      db._queueResolve("limit", [archived]); // requireCollection
      db._queueResolve("orderBy", []); // adminDetailResponse items

      const result = await service.archiveCollection(ACTOR, ID);

      expect(result.status).toBe("archived");
      expect(db.update).not.toHaveBeenCalled();
    });

    it("404s when the collection is missing or already soft-deleted", async () => {
      db._queueResolve("limit", []); // requireCollection (filters isDeleted=false) finds nothing
      await expect(service.archiveCollection(ACTOR, ID)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // -- soft delete -----------------------------------------------------------

  describe("deleteCollection", () => {
    it("sets isDeleted=true + deletedAt and preserves linked items", async () => {
      const active = makeCollectionRow({ isDeleted: false });
      const deleted = makeCollectionRow({ isDeleted: true, deletedAt: new Date() });
      const item = makeItemRow();
      db._queueResolve("limit", [active]); // requireAnyCollection
      db._queueResolve("returning", [deleted]); // updateCollection
      db._queueResolve("orderBy", [item]); // adminDetailResponse items

      const result = await service.deleteCollection(ACTOR, ID);

      expect(result.isDeleted).toBe(true);
      // 연결 데이터 보존: 물리 삭제가 아니므로 수록 의사가 그대로 남는다
      expect(result.items).toHaveLength(1);
      const patch = db.set.mock.calls[0][0];
      expect(patch.isDeleted).toBe(true);
      expect(patch.deletedAt).toBeInstanceOf(Date);
      expect(patch.updatedBy).toBe(ACTOR);
    });

    it("is idempotent when already deleted (no second write)", async () => {
      const deleted = makeCollectionRow({ isDeleted: true, deletedAt: new Date() });
      db._queueResolve("limit", [deleted]); // requireAnyCollection returns the deleted row
      db._queueResolve("orderBy", []); // adminDetailResponse items

      const result = await service.deleteCollection(ACTOR, ID);

      expect(result.isDeleted).toBe(true);
      expect(db.update).not.toHaveBeenCalled();
    });

    it("404s when the collection never existed", async () => {
      db._queueResolve("limit", []); // requireAnyCollection finds nothing
      await expect(service.deleteCollection(ACTOR, ID)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // -- restore ---------------------------------------------------------------

  describe("restoreCollection", () => {
    it("undeletes a soft-deleted collection back to a safe draft state", async () => {
      const deleted = makeCollectionRow({ isDeleted: true, deletedAt: new Date() });
      const restored = makeCollectionRow({ isDeleted: false, deletedAt: null, status: "draft" });
      db._queueResolve("limit", [deleted]); // requireAnyCollection
      db._queueResolve("returning", [restored]); // updateCollection
      db._queueResolve("orderBy", []); // adminDetailResponse items

      const result = await service.restoreCollection(ACTOR, ID);

      expect(result.isDeleted).toBe(false);
      expect(result.status).toBe("draft");
      const patch = db.set.mock.calls[0][0];
      expect(patch).toEqual(
        expect.objectContaining({
          isDeleted: false,
          deletedAt: null,
          status: "draft",
          updatedBy: ACTOR,
        }),
      );
    });

    it("un-archives an archived collection back to draft (never auto-republishes)", async () => {
      const archived = makeCollectionRow({ isDeleted: false, status: "archived" });
      const restored = makeCollectionRow({ isDeleted: false, status: "draft" });
      db._queueResolve("limit", [archived]); // requireAnyCollection
      db._queueResolve("returning", [restored]); // updateCollection
      db._queueResolve("orderBy", []); // items

      const result = await service.restoreCollection(ACTOR, ID);

      expect(result.status).toBe("draft");
      expect(db.set.mock.calls[0][0].status).toBe("draft");
    });

    it("is a no-op for an already-active collection (does not unpublish)", async () => {
      const published = makeCollectionRow({ isDeleted: false, status: "published" });
      db._queueResolve("limit", [published]); // requireAnyCollection
      db._queueResolve("orderBy", []); // items

      const result = await service.restoreCollection(ACTOR, ID);

      // 활성 published 컬렉션을 함부로 draft 로 내리지 않는다
      expect(result.status).toBe("published");
      expect(db.update).not.toHaveBeenCalled();
    });

    it("404s when the collection never existed", async () => {
      db._queueResolve("limit", []); // requireAnyCollection finds nothing
      await expect(service.restoreCollection(ACTOR, ID)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
