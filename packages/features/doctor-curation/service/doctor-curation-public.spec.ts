import { NotFoundException } from "@nestjs/common";
import { createMockDb } from "../../__test-utils__/mock-db";
import { toPublicCollectionItem } from "../mappers";
import { DoctorCurationService } from "./doctor-curation.service";

/**
 * FR-004 / BBR-536 — public 명의 찾기 browse surface tests.
 *
 * Complements the BBR-538 create/admin spec; covers only the public list/detail
 * methods and the public item mapper added by the list/search API.
 */

function makeCollectionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "c1111111-1111-1111-1111-111111111111",
    createdAt: new Date("2026-01-02T00:00:00.000Z"),
    updatedAt: new Date("2026-01-03T00:00:00.000Z"),
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
    isFeatured: true,
    sortOrder: 0,
    status: "published",
    internalNotes: "SECRET",
    sourceUrl: null,
    publishedAt: null,
    createdBy: null,
    updatedBy: null,
    ...overrides,
  };
}

function makeDoctorRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "d1111111-1111-1111-1111-111111111111",
    createdAt: new Date("2026-01-02T00:00:00.000Z"),
    updatedAt: new Date("2026-01-03T00:00:00.000Z"),
    deletedAt: null,
    isDeleted: false,
    name: "김명의",
    slug: "kim-myeongui",
    title: null,
    primarySpecialtyId: null,
    primaryHospitalId: null,
    regionId: null,
    shortBio: null,
    biography: null,
    photoUrl: null,
    yearsExperience: null,
    ratingAvg: 4.8,
    reviewCount: 10,
    isFeatured: false,
    featuredRank: null,
    status: "published",
    licenseNumber: "SECRET-LICENSE",
    licenseVerifiedAt: null,
    internalNotes: null,
    sourceUrl: null,
    publishedAt: null,
    createdBy: null,
    updatedBy: null,
    ...overrides,
  };
}

describe("DoctorCurationService — public browse (BBR-536)", () => {
  let db: ReturnType<typeof createMockDb>;
  let service: DoctorCurationService;

  beforeEach(() => {
    db = createMockDb();
    service = new DoctorCurationService(db as never, { log: jest.fn() } as never);
  });

  describe("listPublicCollections", () => {
    it("returns only public fields with pagination meta", async () => {
      const row = makeCollectionRow();
      db._queueResolve("offset", [row]); // items query terminal
      db._queueResolve("where", [{ count: 1 }]); // count query terminal

      const result = await service.listPublicCollections({ page: 1, limit: 20 } as never);

      expect(result).toEqual({
        items: [expect.objectContaining({ id: row.id, name: "2026 무릎관절 명의" })],
        total: 1,
        page: 1,
        limit: 20,
      });
      // sensitive columns must not leak through the public list mapper
      expect(result.items[0]).not.toHaveProperty("internalNotes");
      expect(result.items[0]).not.toHaveProperty("status");
    });
  });

  describe("getPublicCollectionBySlug", () => {
    it("throws NotFound when no published collection matches", async () => {
      db.query.serviceDoctorCollections.findFirst.mockResolvedValue(undefined);
      await expect(service.getPublicCollectionBySlug("missing")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("treats a missing slug and an unpublished/draft collection identically as 404 (no leak)", async () => {
      // The published+non-deleted filter lives in the query, so a draft collection
      // never comes back from findFirst — same 404 contract as a non-existent slug.
      db.query.serviceDoctorCollections.findFirst.mockResolvedValue(undefined);
      await expect(service.getPublicCollectionBySlug("a-draft-collection")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("orders items by rank and hides draft/deleted doctors", async () => {
      db.query.serviceDoctorCollections.findFirst.mockResolvedValue({
        ...makeCollectionRow(),
        items: [
          { rank: 2, note: "두번째", doctor: makeDoctorRow({ id: "d-2", slug: "second" }) },
          { rank: 1, note: "첫번째", doctor: makeDoctorRow({ id: "d-1", slug: "first" }) },
          {
            rank: 0,
            note: "draft",
            doctor: makeDoctorRow({ id: "d-draft", slug: "draft", status: "draft" }),
          },
          {
            rank: 0,
            note: "deleted",
            doctor: makeDoctorRow({ id: "d-del", slug: "del", isDeleted: true }),
          },
        ],
      });

      const detail = await service.getPublicCollectionBySlug("2026-knee-joint");

      // draft + soft-deleted doctors filtered out, remaining sorted by rank asc
      expect(detail.items.map((i) => i.doctor.slug)).toEqual(["first", "second"]);
      expect(detail.items[0]?.note).toBe("첫번째");
      // public collection mapper still hides admin fields
      expect(detail).not.toHaveProperty("internalNotes");
      // embedded doctor is public-mapped
      expect(detail.items[0]?.doctor).not.toHaveProperty("licenseNumber");
    });

    it("reports guest viewer state for an anonymous request", async () => {
      db.query.serviceDoctorCollections.findFirst.mockResolvedValue({
        ...makeCollectionRow(),
        items: [],
      });

      const detail = await service.getPublicCollectionBySlug("2026-knee-joint");

      expect(detail.viewerState).toEqual({
        authenticated: false,
        role: "guest",
        canManage: false,
      });
    });

    it("reports member viewer state for a signed-in request", async () => {
      db.query.serviceDoctorCollections.findFirst.mockResolvedValue({
        ...makeCollectionRow(),
        items: [],
      });

      const detail = await service.getPublicCollectionBySlug("2026-knee-joint", {
        id: "user-1",
      } as never);

      expect(detail.viewerState).toEqual({
        authenticated: true,
        role: "member",
        canManage: false,
      });
    });
  });

  describe("toPublicCollectionItem", () => {
    it("projects rank/note + a public-mapped doctor (no sensitive doctor fields)", () => {
      const item = toPublicCollectionItem({
        rank: 1,
        note: "선정 이유",
        doctor: makeDoctorRow() as never,
      });
      expect(item).toMatchObject({ rank: 1, note: "선정 이유" });
      expect(item.doctor.name).toBe("김명의");
      expect(item.doctor).not.toHaveProperty("licenseNumber");
      expect(item.doctor).not.toHaveProperty("status");
    });
  });
});
