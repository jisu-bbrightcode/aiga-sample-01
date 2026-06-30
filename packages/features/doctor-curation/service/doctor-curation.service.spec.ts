import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { createMockDb } from "../../__test-utils__/mock-db";
import { DoctorCurationService } from "./doctor-curation.service";

const ACTOR = "actor-1";

function makeCollectionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
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
    status: "draft",
    internalNotes: "내부 메모",
    sourceUrl: null,
    publishedAt: null,
    createdBy: ACTOR,
    updatedBy: ACTOR,
    ...overrides,
  };
}

function makeItemRow(overrides: Record<string, unknown> = {}) {
  return {
    collectionId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    doctorId: "dddddddd-dddd-dddd-dddd-dddddddddddd",
    rank: 0,
    note: null,
    createdAt: new Date("2026-02-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("DoctorCurationService", () => {
  let db: ReturnType<typeof createMockDb>;
  let audit: { log: jest.Mock; list: jest.Mock };
  let service: DoctorCurationService;

  beforeEach(() => {
    db = createMockDb();
    audit = { log: jest.fn().mockResolvedValue(undefined), list: jest.fn() };
    service = new DoctorCurationService(db as never, audit as never);
  });

  describe("createCollection", () => {
    it("creates a draft collection in initial state and returns admin detail", async () => {
      const row = makeCollectionRow();
      db._tx._queueResolve("returning", [row]); // collection insert terminal

      const result = await service.createCollection(ACTOR, {
        name: row.name,
        slug: row.slug,
        kind: "editorial",
        status: "draft",
      } as never);

      // returned shape = admin detail with empty items list
      expect(result).toEqual(expect.objectContaining({ id: row.id, slug: row.slug, items: [] }));
      expect(result.status).toBe("draft");

      // initial state: draft → publishedAt stays null; audit columns stamped
      const values = db._tx.values.mock.calls[0][0];
      expect(values.publishedAt).toBeNull();
      expect(values.createdBy).toBe(ACTOR);
      expect(values.updatedBy).toBe(ACTOR);
    });

    it("stamps publishedAt when created already published", async () => {
      const row = makeCollectionRow({ status: "published" });
      db._tx._queueResolve("returning", [row]);

      await service.createCollection(ACTOR, {
        name: row.name,
        slug: row.slug,
        kind: "editorial",
        status: "published",
      } as never);

      const values = db._tx.values.mock.calls[0][0];
      expect(values.publishedAt).toBeInstanceOf(Date);
    });

    it("inserts ordered 수록 의사 items alongside the collection", async () => {
      const row = makeCollectionRow();
      const item = makeItemRow({ rank: 1, note: "무릎 권위자" });
      db._tx._queueResolve("returning", [row]); // collection
      db._tx._queueResolve("returning", [item]); // items

      const result = await service.createCollection(ACTOR, {
        name: row.name,
        slug: row.slug,
        kind: "editorial",
        status: "draft",
        items: [{ doctorId: item.doctorId, rank: 1, note: "무릎 권위자" }],
      } as never);

      expect(result.items).toEqual([
        expect.objectContaining({ doctorId: item.doctorId, rank: 1, note: "무릎 권위자" }),
      ]);
      // second insert is the items table, scoped to the new collection id
      const itemValues = db._tx.values.mock.calls[1][0];
      expect(itemValues).toEqual([
        expect.objectContaining({ collectionId: row.id, doctorId: item.doctorId, rank: 1 }),
      ]);
    });

    it("maps a duplicate slug (unique violation) to a 409 Conflict", async () => {
      db.transaction.mockImplementationOnce(() => Promise.reject({ code: "23505" }));

      await expect(
        service.createCollection(ACTOR, {
          name: "dup",
          slug: "dup",
          kind: "editorial",
          status: "draft",
        } as never),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("getCollectionById", () => {
    it("returns the created collection with its items (create reflected in detail)", async () => {
      const row = makeCollectionRow();
      const item = makeItemRow();
      db._queueResolve("limit", [row]); // requireCollection terminal
      db._queueResolve("orderBy", [item]); // items terminal

      const result = await service.getCollectionById(row.id);

      expect(result).toEqual(
        expect.objectContaining({
          id: row.id,
          slug: row.slug,
          items: [expect.objectContaining({ doctorId: item.doctorId })],
        }),
      );
      // BBR-537: admin detail carries an admin viewer state with manage rights
      expect(result.viewerState).toEqual({
        authenticated: true,
        role: "admin",
        canManage: true,
      });
    });

    it("throws NotFound for a missing or soft-deleted collection", async () => {
      db._queueResolve("limit", []); // requireCollection finds nothing
      await expect(service.getCollectionById("missing")).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("updateCollection (BBR-539)", () => {
    it("writes only the provided fields and records change history", async () => {
      const existing = makeCollectionRow();
      const updated = makeCollectionRow({ name: "수정된 명의", subtitle: "새 부제" });
      db._queueResolve("limit", [existing]); // requireCollection terminal
      db._tx._queueResolve("returning", [updated]); // collection update terminal
      db._tx._queueResolve("orderBy", []); // items read-back (items omitted)

      const result = await service.updateCollection(ACTOR, existing.id, {
        name: "수정된 명의",
        subtitle: "새 부제",
      } as never);

      // only allowed fields + updatedBy are written (no status)
      const setArg = db._tx.set.mock.calls[0][0];
      expect(setArg).toEqual({ name: "수정된 명의", subtitle: "새 부제", updatedBy: ACTOR });
      expect(setArg.status).toBeUndefined();

      // change history captured with before/after snapshots
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: ACTOR,
          action: "doctor_collection.updated",
          targetType: "doctor_collection",
          targetId: existing.id,
          payloadBefore: expect.objectContaining({ name: existing.name }),
          payloadAfter: expect.objectContaining({ name: "수정된 명의" }),
        }),
      );

      expect(result).toEqual(
        expect.objectContaining({ id: existing.id, name: "수정된 명의", items: [] }),
      );
    });

    it("replaces the ordered 수록 의사 set when items are provided", async () => {
      const existing = makeCollectionRow();
      const updated = makeCollectionRow();
      const newItem = makeItemRow({ doctorId: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", rank: 1 });
      db._queueResolve("limit", [existing]); // requireCollection
      db._tx._queueResolve("returning", [updated]); // collection update
      db._tx._queueResolve("returning", [newItem]); // insertItems after delete

      const result = await service.updateCollection(ACTOR, existing.id, {
        items: [{ doctorId: newItem.doctorId, rank: 1 }],
      } as never);

      // old items deleted, new ones inserted within the same transaction
      expect(db._tx.delete).toHaveBeenCalled();
      expect(result.items).toEqual([expect.objectContaining({ doctorId: newItem.doctorId })]);
    });

    it("rejects a kind→scope mismatch on the merged row (400)", async () => {
      const existing = makeCollectionRow({ kind: "editorial", specialtyId: null });
      db._queueResolve("limit", [existing]);

      await expect(
        service.updateCollection(ACTOR, existing.id, { kind: "specialty" } as never),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(audit.log).not.toHaveBeenCalled();
    });

    it("throws NotFound for a missing collection", async () => {
      db._queueResolve("limit", []);
      await expect(
        service.updateCollection(ACTOR, "missing", { name: "x" } as never),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("maps a duplicate slug to a 409 Conflict", async () => {
      const existing = makeCollectionRow();
      db._queueResolve("limit", [existing]); // requireCollection
      db.transaction.mockImplementationOnce(() => Promise.reject({ code: "23505" }));

      await expect(
        service.updateCollection(ACTOR, existing.id, { slug: "taken" } as never),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("changeStatus (BBR-539)", () => {
    it("applies an allowed transition, stamps publishedAt, and audits it", async () => {
      const existing = makeCollectionRow({ status: "draft", publishedAt: null });
      const updated = makeCollectionRow({ status: "published" });
      db._queueResolve("limit", [existing]); // requireCollection
      db._queueResolve("returning", [updated]); // status update
      db._queueResolve("orderBy", []); // items read-back

      const result = await service.changeStatus(ACTOR, existing.id, {
        status: "published",
        reason: "발행",
      } as never);

      const setArg = db.set.mock.calls[0][0];
      expect(setArg.status).toBe("published");
      expect(setArg.updatedBy).toBe(ACTOR);
      expect(setArg.publishedAt).toBeInstanceOf(Date);

      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "doctor_collection.status_changed",
          targetId: existing.id,
          payloadBefore: { status: "draft" },
          payloadAfter: { status: "published" },
          reason: "발행",
        }),
      );
      expect(result.status).toBe("published");
    });

    it("does not stamp publishedAt for non-publish transitions", async () => {
      const existing = makeCollectionRow({ status: "published" });
      const updated = makeCollectionRow({ status: "archived" });
      db._queueResolve("limit", [existing]);
      db._queueResolve("returning", [updated]);
      db._queueResolve("orderBy", []);

      await service.changeStatus(ACTOR, existing.id, { status: "archived" } as never);

      expect(db.set.mock.calls[0][0].publishedAt).toBeUndefined();
    });

    it("rejects a disallowed transition (422) without auditing", async () => {
      const existing = makeCollectionRow({ status: "archived" });
      db._queueResolve("limit", [existing]);

      await expect(
        service.changeStatus(ACTOR, existing.id, { status: "published" } as never),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(audit.log).not.toHaveBeenCalled();
    });

    it("throws NotFound for a missing collection", async () => {
      db._queueResolve("limit", []);
      await expect(
        service.changeStatus(ACTOR, "missing", { status: "published" } as never),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("listCollectionHistory (BBR-539)", () => {
    it("returns the audit trail scoped to the collection", async () => {
      const existing = makeCollectionRow();
      db._queueResolve("limit", [existing]); // requireCollection
      audit.list.mockResolvedValue({ rows: [{ id: "1" }], nextCursor: null });

      const result = await service.listCollectionHistory(existing.id, {
        limit: 50,
      } as never);

      expect(audit.list).toHaveBeenCalledWith(
        expect.objectContaining({ targetType: "doctor_collection", targetId: existing.id }),
      );
      expect(result).toEqual({ rows: [{ id: "1" }], nextCursor: null });
    });

    it("throws NotFound for a missing collection (no existence probe)", async () => {
      db._queueResolve("limit", []);
      await expect(service.listCollectionHistory("missing", {} as never)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(audit.list).not.toHaveBeenCalled();
    });
  });
});
