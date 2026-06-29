import type { ServiceSearchDocument } from "@repo/drizzle/schema";
import {
  ADMIN_VIEWER_STATE,
  publicViewerState,
  toAdminSearchHit,
  toPublicSearchHit,
} from "./mappers";

function makeDocRow(overrides: Partial<ServiceSearchDocument> = {}): ServiceSearchDocument {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    createdAt: new Date("2026-01-02T00:00:00.000Z"),
    updatedAt: new Date("2026-01-03T00:00:00.000Z"),
    entityType: "doctor",
    entityId: "22222222-2222-2222-2222-222222222222",
    title: "김명의",
    subtitle: "정형외과 · 강남구",
    slug: "kim-myeongui",
    photoUrl: "https://cdn/x.jpg",
    regionId: "33333333-3333-3333-3333-333333333333",
    specialtyId: "44444444-4444-4444-4444-444444444444",
    ratingAvg: 4.8,
    body: "SECRET internal bio text",
    keywords: "ortho 정형외과",
    weight: 100,
    isPublished: true,
    sourceUpdatedAt: new Date("2026-01-01T00:00:00.000Z"),
    searchVector: "ignored",
    ...overrides,
  } as ServiceSearchDocument;
}

describe("toPublicSearchHit", () => {
  it("exposes only the public display fields", () => {
    const hit = toPublicSearchHit(makeDocRow());
    expect(hit).toEqual({
      entityType: "doctor",
      entityId: "22222222-2222-2222-2222-222222222222",
      title: "김명의",
      subtitle: "정형외과 · 강남구",
      slug: "kim-myeongui",
      photoUrl: "https://cdn/x.jpg",
      regionId: "33333333-3333-3333-3333-333333333333",
      specialtyId: "44444444-4444-4444-4444-444444444444",
      ratingAvg: 4.8,
    });
  });

  it("never leaks ranking/index internals", () => {
    const hit = toPublicSearchHit(makeDocRow()) as unknown as Record<string, unknown>;
    for (const field of [
      "body",
      "keywords",
      "weight",
      "isPublished",
      "searchVector",
      "sourceUpdatedAt",
      "id",
    ]) {
      expect(hit).not.toHaveProperty(field);
    }
  });
});

describe("toAdminSearchHit", () => {
  it("includes the index internals with ISO timestamps", () => {
    const hit = toAdminSearchHit(makeDocRow());
    expect(hit.body).toBe("SECRET internal bio text");
    expect(hit.keywords).toBe("ortho 정형외과");
    expect(hit.weight).toBe(100);
    expect(hit.isPublished).toBe(true);
    expect(hit.sourceUpdatedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(hit.createdAt).toBe("2026-01-02T00:00:00.000Z");
    // the raw tsvector is never surfaced even to admins
    expect(hit).not.toHaveProperty("searchVector");
  });
});

describe("viewer state (FR-003 detail / BBR-532)", () => {
  it("publicViewerState is fail-closed — never admin / never unpublished", () => {
    expect(publicViewerState(false)).toEqual({
      authenticated: false,
      isAdmin: false,
      canViewUnpublished: false,
    });
    // even an authenticated public viewer is not privileged on this surface
    expect(publicViewerState(true)).toEqual({
      authenticated: true,
      isAdmin: false,
      canViewUnpublished: false,
    });
  });

  it("ADMIN_VIEWER_STATE grants the privileged view", () => {
    expect(ADMIN_VIEWER_STATE).toEqual({
      authenticated: true,
      isAdmin: true,
      canViewUnpublished: true,
    });
  });
});
