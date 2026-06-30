import {
  buildViewerState,
  toAdminCollection,
  toAdminCollectionDetail,
  toCollectionItem,
  toPublicCollection,
} from "./mappers";

function makeCollectionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    createdAt: new Date("2026-02-01T00:00:00.000Z"),
    updatedAt: new Date("2026-02-02T00:00:00.000Z"),
    deletedAt: null,
    isDeleted: false,
    name: "2026 무릎관절 명의",
    slug: "2026-knee-joint",
    subtitle: "최고의 무릎 명의",
    description: null,
    heroImageUrl: null,
    kind: "editorial" as const,
    specialtyId: null,
    regionId: null,
    isFeatured: true,
    sortOrder: 3,
    status: "published" as const,
    internalNotes: "SECRET 내부 메모",
    sourceUrl: "https://internal.example/source",
    publishedAt: new Date("2026-02-02T00:00:00.000Z"),
    createdBy: "editor-1",
    updatedBy: "editor-2",
    ...overrides,
  };
}

describe("doctor-curation mappers", () => {
  describe("toPublicCollection", () => {
    it("exposes only the public allow-list and never admin-only columns", () => {
      const out = toPublicCollection(makeCollectionRow() as never);

      expect(out).toEqual({
        id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        name: "2026 무릎관절 명의",
        slug: "2026-knee-joint",
        subtitle: "최고의 무릎 명의",
        description: null,
        heroImageUrl: null,
        kind: "editorial",
        specialtyId: null,
        regionId: null,
        isFeatured: true,
        sortOrder: 3,
        createdAt: "2026-02-01T00:00:00.000Z",
        updatedAt: "2026-02-02T00:00:00.000Z",
      });

      // fail-closed: sensitive editorial columns must not leak publicly
      for (const leaked of [
        "status",
        "internalNotes",
        "sourceUrl",
        "publishedAt",
        "createdBy",
        "updatedBy",
        "isDeleted",
        "deletedAt",
      ]) {
        expect(out).not.toHaveProperty(leaked);
      }
    });
  });

  describe("toAdminCollection", () => {
    it("keeps admin columns and normalizes timestamps to ISO", () => {
      const out = toAdminCollection(makeCollectionRow() as never);
      expect(out.status).toBe("published");
      expect(out.internalNotes).toBe("SECRET 내부 메모");
      expect(out.createdAt).toBe("2026-02-01T00:00:00.000Z");
      expect(out.publishedAt).toBe("2026-02-02T00:00:00.000Z");
    });
  });

  describe("toCollectionItem / toAdminCollectionDetail", () => {
    it("maps items and nests them under the admin collection", () => {
      const item = {
        collectionId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        doctorId: "dddddddd-dddd-dddd-dddd-dddddddddddd",
        rank: 2,
        note: "선정 이유",
        createdAt: new Date("2026-02-01T00:00:00.000Z"),
      };
      expect(toCollectionItem(item as never)).toEqual({
        doctorId: item.doctorId,
        rank: 2,
        note: "선정 이유",
        createdAt: "2026-02-01T00:00:00.000Z",
      });

      const detail = toAdminCollectionDetail(makeCollectionRow() as never, [item as never]);
      expect(detail.items).toHaveLength(1);
      expect(detail.id).toBe("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    });
  });

  describe("buildViewerState (BBR-537)", () => {
    it("guest: anonymous viewer, cannot manage", () => {
      expect(buildViewerState("guest")).toEqual({
        authenticated: false,
        role: "guest",
        canManage: false,
      });
    });

    it("member: signed-in viewer, still cannot manage", () => {
      expect(buildViewerState("member")).toEqual({
        authenticated: true,
        role: "member",
        canManage: false,
      });
    });

    it("admin: authenticated operator with manage rights", () => {
      expect(buildViewerState("admin")).toEqual({
        authenticated: true,
        role: "admin",
        canManage: true,
      });
    });
  });
});
