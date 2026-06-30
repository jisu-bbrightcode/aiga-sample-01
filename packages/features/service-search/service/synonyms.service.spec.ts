import { ConflictException, NotFoundException } from "@nestjs/common";
import { createMockDb } from "../../__test-utils__/mock-db";
import { ServiceSearchSynonymsService } from "./synonyms.service";

function makeSynonymRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    createdAt: new Date("2026-01-02T00:00:00.000Z"),
    updatedAt: new Date("2026-01-03T00:00:00.000Z"),
    term: "정형외과",
    expansions: ["뼈", "관절"],
    specialtyId: null,
    isActive: true,
    notes: null,
    ...overrides,
  };
}

describe("ServiceSearchSynonymsService", () => {
  let db: ReturnType<typeof createMockDb>;
  let service: ServiceSearchSynonymsService;

  beforeEach(() => {
    db = createMockDb();
    service = new ServiceSearchSynonymsService(db as never);
  });

  describe("createSynonym", () => {
    it("normalizes term + expansions, defaults to active, and returns the record", async () => {
      db._queueResolve("returning", [makeSynonymRow()]);

      const out = await service.createSynonym("admin-1", {
        term: "  정형외과 ",
        expansions: [" 뼈 ", "관절", "뼈"], // duplicate + padding
      } as never);

      const insertedValues = db.values.mock.calls[0][0];
      expect(insertedValues.term).toBe("정형외과");
      expect(insertedValues.expansions).toEqual(["뼈", "관절"]);
      expect(insertedValues.isActive).toBe(true);
      expect(out.term).toBe("정형외과");
    });

    it("honors an explicit isActive=false initial state", async () => {
      db._queueResolve("returning", [makeSynonymRow({ isActive: false })]);
      await service.createSynonym("admin-1", {
        term: "소아과",
        expansions: ["소아청소년과"],
        isActive: false,
      } as never);
      expect(db.values.mock.calls[0][0].isActive).toBe(false);
    });

    it("rejects when every expansion collapses to the term itself", async () => {
      await expect(
        service.createSynonym("admin-1", {
          term: "정형외과",
          expansions: ["정형외과", " 정형외과 "],
        } as never),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("maps a unique-violation to a 409 ConflictException", async () => {
      db.insert.mockImplementationOnce(() => {
        throw { code: "23505" };
      });
      await expect(
        service.createSynonym("admin-1", { term: "정형외과", expansions: ["뼈"] } as never),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("listSynonyms", () => {
    it("returns mapped items with pagination meta", async () => {
      const row = makeSynonymRow();
      db._queueResolve("offset", [row]); // items terminal
      db._queueResolve("where", [{ count: 1 }]); // count terminal

      const result = await service.listSynonyms({ page: 1, limit: 20 } as never);

      expect(result).toEqual({
        items: [expect.objectContaining({ id: row.id, term: "정형외과" })],
        total: 1,
        page: 1,
        limit: 20,
      });
    });
  });

  describe("getSynonymById", () => {
    it("returns the mapped synonym when found", async () => {
      db._queueResolve("limit", [makeSynonymRow()]);
      const out = await service.getSynonymById("11111111-1111-1111-1111-111111111111");
      expect(out.term).toBe("정형외과");
      expect(out.expansions).toEqual(["뼈", "관절"]);
    });

    it("throws NotFound when absent", async () => {
      db._queueResolve("limit", []);
      await expect(service.getSynonymById("missing")).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  const ID = "11111111-1111-1111-1111-111111111111";

  describe("updateSynonym", () => {
    it("patches allowed fields and writes a change-history entry in one tx", async () => {
      db._queueResolve("limit", [makeSynonymRow()]); // loadOr404
      db._tx._queueResolve("returning", [
        makeSynonymRow({ notes: "검수됨", expansions: ["뼈", "관절", "골절"] }),
      ]);

      const out = await service.updateSynonym("admin-1", ID, {
        notes: "검수됨",
        expansions: ["뼈", "관절", "골절"],
      } as never);

      const patch = db._tx.set.mock.calls[0][0];
      expect(patch.notes).toBe("검수됨");
      expect(patch.expansions).toEqual(["뼈", "관절", "골절"]);
      expect(patch.term).toBeUndefined(); // term not supplied → untouched

      const audit = db._tx.values.mock.calls[0][0];
      expect(audit.action).toBe("search_synonym.updated");
      expect(audit.targetType).toBe("service_search_synonym");
      expect(audit.targetId).toBe(ID);
      expect(audit.actorUserId).toBe("admin-1");
      expect(audit.payloadBefore.notes).toBeNull();
      expect(audit.payloadAfter.notes).toBe("검수됨");
      expect(out.notes).toBe("검수됨");
    });

    it("re-normalizes expansions against a changed term", async () => {
      db._queueResolve("limit", [makeSynonymRow({ term: "정형외과", expansions: ["뼈"] })]);
      db._tx._queueResolve("returning", [makeSynonymRow({ term: "뼈", expansions: ["관절"] })]);

      await service.updateSynonym("admin-1", ID, {
        term: "뼈",
        expansions: ["관절", "뼈"], // "뼈" collapses to the new term and is dropped
      } as never);

      const patch = db._tx.set.mock.calls[0][0];
      expect(patch.term).toBe("뼈");
      expect(patch.expansions).toEqual(["관절"]);
    });

    it("rejects (409) when a term change leaves no valid expansion", async () => {
      db._queueResolve("limit", [makeSynonymRow({ term: "정형외과", expansions: ["뼈"] })]);
      await expect(
        service.updateSynonym("admin-1", ID, { term: "뼈" } as never),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(db.transaction).not.toHaveBeenCalled();
    });

    it("is a no-op (no tx) when the patch matches the current values", async () => {
      db._queueResolve("limit", [makeSynonymRow({ notes: "동일" })]);
      const out = await service.updateSynonym("admin-1", ID, { notes: "동일" } as never);
      expect(db.transaction).not.toHaveBeenCalled();
      expect(out.notes).toBe("동일");
    });

    it("maps a unique-violation on a renamed term to 409", async () => {
      db._queueResolve("limit", [makeSynonymRow()]);
      db._tx.update.mockImplementationOnce(() => {
        throw { code: "23505" };
      });
      await expect(
        service.updateSynonym("admin-1", ID, { term: "이비인후과" } as never),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("throws NotFound when the synonym is absent", async () => {
      db._queueResolve("limit", []);
      await expect(
        service.updateSynonym("admin-1", ID, { notes: "x" } as never),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("setSynonymStatus", () => {
    it("flips active→inactive and records the transition", async () => {
      db._queueResolve("limit", [makeSynonymRow({ isActive: true })]);
      db._tx._queueResolve("returning", [makeSynonymRow({ isActive: false })]);

      const out = await service.setSynonymStatus("admin-2", ID, "inactive", "스팸 정리");

      expect(db._tx.set.mock.calls[0][0]).toEqual({ isActive: false });
      const audit = db._tx.values.mock.calls[0][0];
      expect(audit.action).toBe("search_synonym.status_changed");
      expect(audit.payloadBefore).toEqual({ isActive: true });
      expect(audit.payloadAfter).toEqual({ isActive: false });
      expect(audit.reason).toBe("스팸 정리");
      expect(out.isActive).toBe(false);
    });

    it("is an idempotent no-op when already in the target state", async () => {
      db._queueResolve("limit", [makeSynonymRow({ isActive: true })]);
      const out = await service.setSynonymStatus("admin-2", ID, "active");
      expect(db.transaction).not.toHaveBeenCalled();
      expect(out.isActive).toBe(true);
    });

    it("throws NotFound when the synonym is absent", async () => {
      db._queueResolve("limit", []);
      await expect(service.setSynonymStatus("admin-2", ID, "inactive")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe("listSynonymHistory", () => {
    it("returns newest-first entries with a nextCursor when the page is full", async () => {
      db._queueResolve("limit", [makeSynonymRow()]); // loadOr404
      db._queueResolve("limit", [
        {
          id: 12n,
          action: "search_synonym.status_changed",
          actorUserId: "admin-2",
          targetType: "service_search_synonym",
          targetId: ID,
          payloadBefore: { isActive: true },
          payloadAfter: { isActive: false },
          reason: null,
          createdAt: new Date("2026-02-01T00:00:00.000Z"),
        },
      ]);

      const out = await service.listSynonymHistory(ID, { limit: 1 });
      expect(out.items).toHaveLength(1);
      expect(out.items[0]).toEqual(
        expect.objectContaining({ id: "12", action: "search_synonym.status_changed" }),
      );
      expect(out.nextCursor).toBe("12");
    });

    it("throws NotFound when the synonym is absent", async () => {
      db._queueResolve("limit", []);
      await expect(service.listSynonymHistory("missing", { limit: 20 })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
