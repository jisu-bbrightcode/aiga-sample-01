import { ConflictException, NotFoundException } from "@nestjs/common";
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
  let service: DoctorCurationService;

  beforeEach(() => {
    db = createMockDb();
    service = new DoctorCurationService(db as never);
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

  describe("listCollections", () => {
    it("returns admin rows with pagination meta (create reflected in list)", async () => {
      const row = makeCollectionRow();
      db._queueResolve("offset", [row]); // items query terminal
      db._queueResolve("where", [{ count: 1 }]); // count query terminal

      const result = await service.listCollections({ page: 1, limit: 20 } as never);

      expect(result).toEqual({
        items: [expect.objectContaining({ id: row.id, status: "draft" })],
        total: 1,
        page: 1,
        limit: 20,
      });
    });
  });
});
