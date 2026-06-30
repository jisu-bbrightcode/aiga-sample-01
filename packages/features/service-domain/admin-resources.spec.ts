import {
  type AdminDomainResource,
  compareResources,
  mergeResourcePage,
  toAdminDomainResource,
  totalPages,
} from "./admin-resources";

function resource(overrides: Partial<AdminDomainResource> = {}): AdminDomainResource {
  return {
    id: "a",
    type: "doctor",
    name: "김의사",
    slug: "kim",
    status: "published",
    regionName: "서울",
    specialtyName: "정형외과",
    isFeatured: false,
    updatedAt: "2026-06-01T00:00:00.000Z",
    createdAt: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("toAdminDomainResource", () => {
  it("projects only the contract columns and never leaks sensitive fields", () => {
    const fullRow = {
      id: "d1",
      name: "김명의",
      slug: "kim-myeongui",
      status: "draft" as const,
      regionName: "서울",
      specialtyName: "정형외과",
      isFeatured: true,
      updatedAt: new Date("2026-06-30T04:00:00.000Z"),
      createdAt: new Date("2026-06-01T00:00:00.000Z"),
      // sensitive columns a careless join might carry along:
      licenseNumber: "SECRET-LICENSE",
      internalNotes: "do not show",
      sourceUrl: "https://internal",
    } as never;

    const mapped = toAdminDomainResource(fullRow, "doctor");

    expect(mapped).toEqual({
      id: "d1",
      type: "doctor",
      name: "김명의",
      slug: "kim-myeongui",
      status: "draft",
      regionName: "서울",
      specialtyName: "정형외과",
      isFeatured: true,
      updatedAt: "2026-06-30T04:00:00.000Z",
      createdAt: "2026-06-01T00:00:00.000Z",
    });
    expect(mapped).not.toHaveProperty("licenseNumber");
    expect(mapped).not.toHaveProperty("internalNotes");
    expect(mapped).not.toHaveProperty("sourceUrl");
  });

  it("forces specialtyName to null for hospitals", () => {
    const mapped = toAdminDomainResource(
      {
        id: "h1",
        name: "서울병원",
        slug: "seoul-hospital",
        status: "published",
        regionName: null,
        // even if a specialtyName sneaks in, a hospital must report null
        specialtyName: "should-be-dropped",
        isFeatured: false,
        updatedAt: null,
        createdAt: null,
      },
      "hospital",
    );
    expect(mapped.type).toBe("hospital");
    expect(mapped.specialtyName).toBeNull();
    expect(mapped.regionName).toBeNull();
    expect(mapped.updatedAt).toBeNull();
  });
});

describe("compareResources", () => {
  it("sorts by name ascending / descending", () => {
    const a = resource({ id: "1", name: "가" });
    const b = resource({ id: "2", name: "나" });
    expect([b, a].sort(compareResources("name", "asc"))).toEqual([a, b]);
    expect([a, b].sort(compareResources("name", "desc"))).toEqual([b, a]);
  });

  it("sorts by status in lifecycle order (draft < published < archived)", () => {
    const draft = resource({ id: "1", status: "draft" });
    const published = resource({ id: "2", status: "published" });
    const archived = resource({ id: "3", status: "archived" });
    expect([archived, published, draft].sort(compareResources("status", "asc"))).toEqual([
      draft,
      published,
      archived,
    ]);
  });

  it("sorts by updatedAt and breaks ties by id ascending regardless of order", () => {
    const older = resource({ id: "z", updatedAt: "2026-01-01T00:00:00.000Z" });
    const newer = resource({ id: "a", updatedAt: "2026-12-01T00:00:00.000Z" });
    expect([older, newer].sort(compareResources("updatedAt", "desc"))).toEqual([newer, older]);

    // equal sort key → id ascending tiebreaker, even when order is desc
    const t = "2026-06-01T00:00:00.000Z";
    const x = resource({ id: "x", updatedAt: t });
    const y = resource({ id: "y", updatedAt: t });
    expect([y, x].sort(compareResources("updatedAt", "desc"))).toEqual([x, y]);
  });
});

describe("mergeResourcePage", () => {
  const d1 = resource({ id: "d1", type: "doctor", name: "A" });
  const d2 = resource({ id: "d2", type: "doctor", name: "C" });
  const h1 = resource({ id: "h1", type: "hospital", name: "B" });
  const h2 = resource({ id: "h2", type: "hospital", name: "D" });

  it("interleaves both tables by the sort key and slices the page window", () => {
    // each table pre-sorted asc by name; page 1 size 2 → first two of merged
    const page1 = mergeResourcePage([d1, d2], [h1, h2], {
      sort: "name",
      order: "asc",
      page: 1,
      limit: 2,
    });
    expect(page1.map((r) => r.name)).toEqual(["A", "B"]);

    const page2 = mergeResourcePage([d1, d2], [h1, h2], {
      sort: "name",
      order: "asc",
      page: 2,
      limit: 2,
    });
    expect(page2.map((r) => r.name)).toEqual(["C", "D"]);
  });

  it("returns an empty window past the end", () => {
    expect(
      mergeResourcePage([d1], [h1], { sort: "name", order: "asc", page: 5, limit: 2 }),
    ).toEqual([]);
  });
});

describe("totalPages", () => {
  it("computes ceil(total/limit) and 0 for empty results", () => {
    expect(totalPages(137, 20)).toBe(7);
    expect(totalPages(40, 20)).toBe(2);
    expect(totalPages(0, 20)).toBe(0);
    expect(totalPages(1, 20)).toBe(1);
  });
});
