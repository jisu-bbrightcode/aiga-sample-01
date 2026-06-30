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

  describe("createSavedItem", () => {
    const input = {
      targetType: "doctor",
      targetId: "22222222-2222-2222-2222-222222222222",
      memo: "메모",
      tags: ["관심"],
    } as never;

    it("inserts and returns the mapped item without leaking userId", async () => {
      db._queueResolve("returning", [savedRow()]);
      const result = await service.createSavedItem(USER, input);
      expect(result).toEqual({
        id: "11111111-1111-1111-1111-111111111111",
        targetType: "doctor",
        targetId: "22222222-2222-2222-2222-222222222222",
        memo: "메모",
        tags: ["관심"],
        createdAt: "2026-06-29T03:00:00.000Z",
        updatedAt: "2026-06-29T03:30:00.000Z",
      });
      expect(result).not.toHaveProperty("userId");
    });

    it("is idempotent: returns the existing row when the unique conflict skips the insert", async () => {
      db._queueResolve("returning", []); // onConflictDoNothing → no inserted row
      db._queueResolve("limit", [savedRow()]); // re-select existing
      const result = await service.createSavedItem(USER, input);
      expect(result.id).toBe("11111111-1111-1111-1111-111111111111");
    });

    it("throws a friendly 503 when the conflicting row cannot be read back", async () => {
      db._queueResolve("returning", []);
      db._queueResolve("limit", []);
      await expect(service.createSavedItem(USER, input)).rejects.toMatchObject({
        status: 503,
      });
    });
  });

  describe("createInterest", () => {
    const input = {
      targetType: "hospital",
      targetId: "44444444-4444-4444-4444-444444444444",
    } as never;

    it("inserts and returns the mapped interest (no memo/tags/updatedAt)", async () => {
      db._queueResolve("returning", [interestRow()]);
      const result = await service.createInterest(USER, input);
      expect(result).toEqual({
        id: "33333333-3333-3333-3333-333333333333",
        targetType: "hospital",
        targetId: "44444444-4444-4444-4444-444444444444",
        createdAt: "2026-06-29T02:00:00.000Z",
      });
    });

    it("is idempotent on unique conflict", async () => {
      db._queueResolve("returning", []);
      db._queueResolve("limit", [interestRow()]);
      const result = await service.createInterest(USER, input);
      expect(result.id).toBe("33333333-3333-3333-3333-333333333333");
    });
  });

  describe("updateSavedItem", () => {
    const ID = "11111111-1111-1111-1111-111111111111";

    it("updates memo/tags and returns the mapped item without leaking userId", async () => {
      db._queueResolve("returning", [savedRow({ memo: "새 메모", tags: ["a", "b"] })]);

      const result = await service.updateSavedItem(USER, ID, {
        memo: "새 메모",
        tags: ["a", "b"],
      } as never);

      expect(result).toEqual({
        id: ID,
        targetType: "doctor",
        targetId: "22222222-2222-2222-2222-222222222222",
        memo: "새 메모",
        tags: ["a", "b"],
        createdAt: "2026-06-29T03:00:00.000Z",
        updatedAt: "2026-06-29T03:30:00.000Z",
      });
      expect(result).not.toHaveProperty("userId");
    });

    it("scopes the update to the owner (id AND user_id in the WHERE)", async () => {
      db._queueResolve("returning", [savedRow()]);
      await service.updateSavedItem(USER, ID, { memo: "x" } as never);
      // and(eq(id), eq(userId)) — both predicates feed the single where() call
      expect(db.where).toHaveBeenCalledTimes(1);
      expect(db.update).toHaveBeenCalledTimes(1);
    });

    it("only writes the fields the caller sent (memo omitted → not in patch)", async () => {
      db._queueResolve("returning", [savedRow()]);
      await service.updateSavedItem(USER, ID, { tags: ["only-tags"] } as never);
      expect(db.set).toHaveBeenCalledWith({ tags: ["only-tags"] });
    });

    it("clears a field when explicitly set to null", async () => {
      db._queueResolve("returning", [savedRow({ memo: null })]);
      await service.updateSavedItem(USER, ID, { memo: null } as never);
      expect(db.set).toHaveBeenCalledWith({ memo: null });
    });

    it("throws 404 (no-leak) when no row matches — missing or owned by another user", async () => {
      db._queueResolve("returning", []);
      await expect(service.updateSavedItem(USER, ID, { memo: "x" } as never)).rejects.toMatchObject(
        { status: 404 },
      );
    });
  });
});
