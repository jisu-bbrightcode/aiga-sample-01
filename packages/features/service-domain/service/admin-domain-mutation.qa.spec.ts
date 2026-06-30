/**
 * PB-ADMIN-DOMAIN-QA-001 / BBR-683 — admin domain mutation QA regression.
 *
 * The CRUD + status + audit behaviour is unit-tested in
 * `service-domain.service.spec.ts`. This QA spec closes one boundary that those
 * tests assert only indirectly: the *generic edit path* (`PATCH .../doctors|
 * hospitals/:id`) must never change a record's publish status.
 *
 * Why it matters (AC#1 — "허용된 전이만"): publish status is a guarded
 * lifecycle. `changeDomainResourceStatus` runs `assertStatusTransition`
 * (e.g. archived → published is rejected with 422). The edit DTOs still carry an
 * optional `status` field for shape compatibility with the create DTOs, and the
 * service deliberately strips it (`void status`). If a future refactor let that
 * `status` reach the `set` patch, an operator could flip an archived record
 * straight back onto the public surface through the edit form — silently
 * bypassing the transition policy and its audit trail. These regression tests
 * pin the strip so that bypass can never regress unnoticed.
 *
 * Pure unit level (mock db + mock audit) — no DB or HTTP layer required.
 */

import { createMockDb } from "../../__test-utils__/mock-db";
import { ServiceDomainService } from "./service-domain.service";

function makeDoctorRow(overrides: Record<string, unknown> = {}) {
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
    status: "archived",
    licenseNumber: "SECRET",
    licenseVerifiedAt: null,
    internalNotes: null,
    sourceUrl: null,
    publishedAt: null,
    createdBy: null,
    updatedBy: null,
    ...overrides,
  };
}

function makeHospitalRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "55555555-5555-5555-5555-555555555555",
    createdAt: new Date("2026-01-02T00:00:00.000Z"),
    updatedAt: new Date("2026-01-03T00:00:00.000Z"),
    deletedAt: null,
    isDeleted: false,
    name: "서울병원",
    slug: "seoul-hospital",
    summary: null,
    description: null,
    addressLine: null,
    phone: null,
    websiteUrl: null,
    regionId: null,
    photoUrl: null,
    ratingAvg: 4.5,
    reviewCount: 7,
    isFeatured: false,
    status: "archived",
    businessRegistrationNo: "SECRET",
    internalNotes: null,
    sourceUrl: null,
    publishedAt: null,
    createdBy: null,
    updatedBy: null,
    ...overrides,
  };
}

describe("PB-ADMIN-DOMAIN-QA-001 — edit path cannot change publish status (AC#1)", () => {
  let db: ReturnType<typeof createMockDb>;
  let audit: { log: jest.Mock; list: jest.Mock };
  let service: ServiceDomainService;

  beforeEach(() => {
    db = createMockDb();
    audit = { log: jest.fn().mockResolvedValue(undefined), list: jest.fn() };
    service = new ServiceDomainService(db as never, audit as never);
  });

  it("updateDoctor strips a status in the payload — set patch never touches status/publishedAt", async () => {
    const before = makeDoctorRow({ status: "archived", publishedAt: null });
    db._queueResolve("limit", [before]); // requireDoctor terminal
    db._tx._queueResolve("returning", [makeDoctorRow({ shortBio: "갱신" })]);

    // An operator tries to re-publish an archived doctor through the edit form.
    await service.updateDoctor("admin-1", before.id, {
      shortBio: "갱신",
      status: "published",
    } as never);

    // The transactional update set() must carry the content edit but NOT status,
    // and must not stamp publishedAt — that lifecycle is owned by changeStatus.
    expect(db._tx.set).toHaveBeenCalledTimes(1);
    const patch = db._tx.set.mock.calls[0][0];
    expect(patch).toEqual(expect.objectContaining({ shortBio: "갱신", updatedBy: "admin-1" }));
    expect(patch).not.toHaveProperty("status");
    expect(patch).not.toHaveProperty("publishedAt");
  });

  it("updateDoctor audits the edit as a content update, never as a status change", async () => {
    const before = makeDoctorRow({ status: "archived" });
    db._queueResolve("limit", [before]);
    db._tx._queueResolve("returning", [makeDoctorRow({ shortBio: "갱신" })]);

    await service.updateDoctor("admin-1", before.id, {
      shortBio: "갱신",
      status: "published",
    } as never);

    expect(audit.log).toHaveBeenCalledTimes(1);
    const entry = audit.log.mock.calls[0][0];
    expect(entry.action).toBe("domain.doctor.updated");
    expect(entry.action).not.toBe("service_domain.status_changed");
  });

  it("updateHospital strips a status in the payload — set patch never touches status/publishedAt", async () => {
    const before = makeHospitalRow({ status: "archived", publishedAt: null });
    db._queueResolve("limit", [before]); // requireHospital terminal
    db._queueResolve("returning", [makeHospitalRow({ summary: "갱신" })]);

    await service.updateHospital("admin-1", before.id, {
      summary: "갱신",
      status: "published",
    } as never);

    expect(db.set).toHaveBeenCalledTimes(1);
    const patch = db.set.mock.calls[0][0];
    expect(patch).toEqual(expect.objectContaining({ summary: "갱신", updatedBy: "admin-1" }));
    expect(patch).not.toHaveProperty("status");
    expect(patch).not.toHaveProperty("publishedAt");
  });

  it("updateHospital audits the edit as a content update, never as a status change", async () => {
    const before = makeHospitalRow({ status: "archived" });
    db._queueResolve("limit", [before]);
    db._queueResolve("returning", [makeHospitalRow({ summary: "갱신" })]);

    await service.updateHospital("admin-1", before.id, {
      summary: "갱신",
      status: "published",
    } as never);

    expect(audit.log).toHaveBeenCalledTimes(1);
    const entry = audit.log.mock.calls[0][0];
    expect(entry.action).toBe("domain.hospital.updated");
    expect(entry.action).not.toBe("service_domain.status_changed");
  });
});
