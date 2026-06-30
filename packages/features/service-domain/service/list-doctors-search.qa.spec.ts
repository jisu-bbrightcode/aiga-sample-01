/**
 * QA — 명의 찾기 검색·필터·정렬 server contract (FR-004 / BBR-493).
 *
 * The app sort selector (apps/app .../doctor-search-params.ts) stakes its
 * correctness on `GET /service/doctors` doing exactly two things:
 *
 *   - `featured=true`  (UI "추천순") → narrow to featured doctors, order by
 *     featuredRank asc then ratingAvg desc.
 *   - `featured` absent (UI "평점순") → order by ratingAvg desc then createdAt desc.
 *
 * and on the keyword / 진료과 / 지역 filters reaching the WHERE clause. The app
 * side is unit-tested, but the server end of that contract had no test asserting
 * the WHERE columns or the ORDER BY switch. This QA spec pins it down so a future
 * refactor of `listDoctors` cannot silently break the app's search/sort behavior.
 *
 * Assertions read the drizzle SQL the service built (column names + direction)
 * rather than opaque internals, so they survive cosmetic query refactors.
 */
import { createMockDb } from "../../__test-utils__/mock-db";
import { ServiceDomainService } from "./service-domain.service";

/** Recursively collect the column names referenced by a drizzle SQL fragment. */
function columnsOf(sql: unknown): string[] {
  const out: string[] = [];
  const node = sql as { name?: string; queryChunks?: unknown[] };
  if (node?.name) out.push(node.name);
  for (const chunk of node?.queryChunks ?? []) out.push(...columnsOf(chunk));
  return out;
}

/** Decode an `asc()` / `desc()` term into `{ column, direction }`. */
function orderTerm(sql: unknown): { column: string; direction: "asc" | "desc" } {
  const chunks = (sql as { queryChunks?: { name?: string; value?: string[] }[] }).queryChunks ?? [];
  const column = chunks.find((c) => c?.name)?.name ?? "?";
  const tail = chunks.map((c) => c?.value?.[0] ?? "").join("");
  return { column, direction: tail.includes("desc") ? "desc" : "asc" };
}

const PUBLISHED_GUARD = ["status", "is_deleted"] as const;

function makeRow() {
  return {
    id: "11111111-1111-1111-1111-111111111111",
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
    licenseNumber: "SECRET",
    licenseVerifiedAt: null,
    internalNotes: null,
    sourceUrl: null,
    publishedAt: null,
    createdBy: null,
    updatedBy: null,
  };
}

describe("listDoctors — 검색·필터·정렬 contract (FR-004 QA / BBR-493)", () => {
  let db: ReturnType<typeof createMockDb>;
  let service: ServiceDomainService;

  beforeEach(() => {
    db = createMockDb();
    service = new ServiceDomainService(db as never, { log: jest.fn() } as never);
    db._queueResolve("offset", [makeRow()]); // items query terminal
    db._queueResolve("where", [{ count: 1 }]); // count query terminal
  });

  it("추천순(featured=true): filters to featured + orders featuredRank asc, ratingAvg desc", async () => {
    await service.listDoctors({ page: 1, limit: 12, featured: true } as never);

    const whereCols = columnsOf(db.where.mock.calls[0]?.[0]);
    expect(whereCols).toEqual(expect.arrayContaining([...PUBLISHED_GUARD, "is_featured"]));

    const order = (db.orderBy.mock.calls[0] ?? []).map(orderTerm);
    expect(order).toEqual([
      { column: "featured_rank", direction: "asc" },
      { column: "rating_avg", direction: "desc" },
    ]);
  });

  it("평점순(featured absent): no featured filter + orders ratingAvg desc, createdAt desc", async () => {
    await service.listDoctors({ page: 1, limit: 12 } as never);

    const whereCols = columnsOf(db.where.mock.calls[0]?.[0]);
    expect(whereCols).toEqual(expect.arrayContaining([...PUBLISHED_GUARD]));
    expect(whereCols).not.toContain("is_featured");

    const order = (db.orderBy.mock.calls[0] ?? []).map(orderTerm);
    expect(order).toEqual([
      { column: "rating_avg", direction: "desc" },
      { column: "created_at", direction: "desc" },
    ]);
  });

  it("keyword + 진료과 + 지역 filters all reach the WHERE clause", async () => {
    await service.listDoctors({
      page: 1,
      limit: 12,
      q: "김",
      specialtyId: "22222222-2222-2222-2222-222222222222",
      regionId: "33333333-3333-3333-3333-333333333333",
    } as never);

    const whereCols = columnsOf(db.where.mock.calls[0]?.[0]);
    // 진료과 filter is the denormalized PRIMARY specialty (not the full M:N set).
    expect(whereCols).toEqual(
      expect.arrayContaining([
        ...PUBLISHED_GUARD,
        "primary_specialty_id",
        "region_id",
        "name", // keyword → ilike(name)
      ]),
    );
  });

  it("the count query reuses the same WHERE as the items query (consistent total)", async () => {
    await service.listDoctors({
      page: 2,
      limit: 5,
      regionId: "33333333-3333-3333-3333-333333333333",
    } as never);

    // both items + count chains call .where() with the identical fragment
    expect(db.where.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(columnsOf(db.where.mock.calls[0]?.[0])).toEqual(columnsOf(db.where.mock.calls[1]?.[0]));
  });
});
