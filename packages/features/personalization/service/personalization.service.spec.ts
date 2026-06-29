import { createMockDb } from "../../__test-utils__/mock-db";
import { decodeCursor } from "../helpers/cursor";
import { PersonalizationService } from "./personalization.service";

const USER = "user-1";

function savedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    userId: USER,
    targetType: "doctor",
    targetId: "22222222-2222-2222-2222-222222222222",
    memo: "메모",
    tags: ["관심"],
    createdAt: new Date("2026-06-29T03:00:00.000Z"),
    updatedAt: new Date("2026-06-29T03:30:00.000Z"),
    ...overrides,
  };
}

function interestRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "33333333-3333-3333-3333-333333333333",
    userId: USER,
    targetType: "hospital",
    targetId: "44444444-4444-4444-4444-444444444444",
    createdAt: new Date("2026-06-29T02:00:00.000Z"),
    ...overrides,
  };
}

function historyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "55555555-5555-5555-5555-555555555555",
    userId: USER,
    query: "소아과",
    filters: { region: "seoul" },
    createdAt: new Date("2026-06-29T01:00:00.000Z"),
    ...overrides,
  };
}

describe("PersonalizationService", () => {
  let db: ReturnType<typeof createMockDb>;
  let service: PersonalizationService;

  beforeEach(() => {
    db = createMockDb();
    service = new PersonalizationService(db as never);
  });

  describe("listSavedItems", () => {
    it("returns owner records without leaking userId and serializes timestamps", async () => {
      db._queueResolve("limit", [savedRow()]);

      const result = await service.listSavedItems(USER, { limit: 20 } as never);

      expect(result.nextCursor).toBeNull();
      expect(result.items).toHaveLength(1);
      const item = result.items[0]!;
      expect(item).toEqual({
        id: "11111111-1111-1111-1111-111111111111",
        targetType: "doctor",
        targetId: "22222222-2222-2222-2222-222222222222",
        memo: "메모",
        tags: ["관심"],
        createdAt: "2026-06-29T03:00:00.000Z",
        updatedAt: "2026-06-29T03:30:00.000Z",
      });
      expect(item).not.toHaveProperty("userId");
    });

    it("emits nextCursor and drops the sentinel row when more than `limit` exist", async () => {
      const rows = [
        savedRow({ id: "a", createdAt: new Date("2026-06-29T03:00:00.000Z") }),
        savedRow({ id: "b", createdAt: new Date("2026-06-29T02:00:00.000Z") }),
        savedRow({ id: "c", createdAt: new Date("2026-06-29T01:00:00.000Z") }),
      ];
      db._queueResolve("limit", rows);

      const result = await service.listSavedItems(USER, { limit: 2 } as never);

      expect(result.items.map((i) => i.id)).toEqual(["a", "b"]);
      expect(result.nextCursor).not.toBeNull();
      expect(decodeCursor(result.nextCursor)).toEqual({
        createdAt: "2026-06-29T02:00:00.000Z",
        id: "b",
      });
    });

    it("fetches limit+1 rows to detect the next page", async () => {
      db._queueResolve("limit", []);
      await service.listSavedItems(USER, { limit: 20 } as never);
      expect(db.limit).toHaveBeenCalledWith(21);
    });

    it("returns an empty page for a user with no saves", async () => {
      db._queueResolve("limit", []);
      const result = await service.listSavedItems(USER, { limit: 20 } as never);
      expect(result).toEqual({ items: [], nextCursor: null });
    });
  });

  describe("listInterests", () => {
    it("maps interest rows (no memo/tags/updatedAt)", async () => {
      db._queueResolve("limit", [interestRow()]);
      const result = await service.listInterests(USER, { limit: 20 } as never);
      expect(result.items[0]).toEqual({
        id: "33333333-3333-3333-3333-333333333333",
        targetType: "hospital",
        targetId: "44444444-4444-4444-4444-444444444444",
        createdAt: "2026-06-29T02:00:00.000Z",
      });
    });
  });

  describe("listSearchHistory", () => {
    it("maps history rows with query + filters, newest first", async () => {
      db._queueResolve("limit", [historyRow()]);
      const result = await service.listSearchHistory(USER, { limit: 20 } as never);
      expect(result.items[0]).toEqual({
        id: "55555555-5555-5555-5555-555555555555",
        query: "소아과",
        filters: { region: "seoul" },
        createdAt: "2026-06-29T01:00:00.000Z",
      });
    });

    it("normalizes null filters", async () => {
      db._queueResolve("limit", [historyRow({ filters: null })]);
      const result = await service.listSearchHistory(USER, { limit: 20 } as never);
      expect(result.items[0]!.filters).toBeNull();
    });
  });

  describe("getSavedItem", () => {
    const ID = "11111111-1111-1111-1111-111111111111";

    it("returns the owner's item without leaking userId and serializes timestamps", async () => {
      db._queueResolve("limit", [savedRow()]);

      const result = await service.getSavedItem(USER, ID);

      expect(result).toEqual({
        id: ID,
        targetType: "doctor",
        targetId: "22222222-2222-2222-2222-222222222222",
        memo: "메모",
        tags: ["관심"],
        createdAt: "2026-06-29T03:00:00.000Z",
        updatedAt: "2026-06-29T03:30:00.000Z",
      });
      expect(result).not.toHaveProperty("userId");
    });

    it("scopes the read to the owner and fetches a single row", async () => {
      db._queueResolve("limit", [savedRow()]);

      await service.getSavedItem(USER, ID);

      // owner scope is enforced at the data layer, not just by the auth guard
      expect(db.where).toHaveBeenCalled();
      expect(db.limit).toHaveBeenCalledWith(1);
    });

    it("throws 404 when no row matches (missing or owned by another user)", async () => {
      db._queueResolve("limit", []);

      await expect(service.getSavedItem(USER, ID)).rejects.toMatchObject({ status: 404 });
    });
  });
});
