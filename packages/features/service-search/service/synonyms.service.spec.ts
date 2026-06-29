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
});
