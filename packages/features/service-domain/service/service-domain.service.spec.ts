import { ConflictException, NotFoundException } from "@nestjs/common";
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
    status: "published",
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

describe("ServiceDomainService", () => {
  let db: ReturnType<typeof createMockDb>;
  let service: ServiceDomainService;

  beforeEach(() => {
    db = createMockDb();
    service = new ServiceDomainService(db as never);
  });

  describe("listDoctors", () => {
    it("returns only public fields with pagination meta", async () => {
      const row = makeDoctorRow();
      db._queueResolve("offset", [row]); // items query terminal
      db._queueResolve("where", [{ count: 1 }]); // count query terminal

      const result = await service.listDoctors({ page: 1, limit: 20 } as never);

      expect(result).toEqual({
        items: [expect.objectContaining({ id: row.id, name: "김명의" })],
        total: 1,
        page: 1,
        limit: 20,
      });
      // sensitive columns must not leak through the list mapper
      expect(result.items[0]).not.toHaveProperty("licenseNumber");
      expect(result.items[0]).not.toHaveProperty("status");
    });
  });

  describe("getDoctorBySlug", () => {
    it("throws NotFound when no published doctor matches", async () => {
      db.query.serviceDoctors.findFirst.mockResolvedValue(undefined);
      await expect(service.getDoctorBySlug("missing")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("maps relations and hides non-published affiliated hospitals", async () => {
      db.query.serviceDoctors.findFirst.mockResolvedValue({
        ...makeDoctorRow(),
        region: { id: "r1", name: "서울", slug: "seoul", parentId: null, sortOrder: 0 },
        specialties: [
          {
            specialty: {
              id: "s1",
              name: "정형외과",
              slug: "ortho",
              description: null,
              sortOrder: 0,
              isActive: true,
            },
          },
        ],
        hospitals: [
          {
            role: "원장",
            isPrimary: true,
            hospital: { ...makeHospitalRow(), status: "published" },
          },
          {
            role: null,
            isPrimary: false,
            hospital: { ...makeHospitalRow({ id: "draft-h" }), status: "draft" },
          },
        ],
        credentials: [],
      });

      const detail = await service.getDoctorBySlug("kim-myeongui");

      expect(detail.region?.slug).toBe("seoul");
      expect(detail.specialties).toHaveLength(1);
      // only the published affiliation survives
      expect(detail.hospitals).toHaveLength(1);
      const [affiliation] = detail.hospitals;
      expect(affiliation?.role).toBe("원장");
      expect(affiliation?.hospital).not.toHaveProperty("businessRegistrationNo");
    });
  });

  describe("createDoctor", () => {
    it("stamps publishedAt + audit ids and returns the admin record", async () => {
      const created = makeDoctorRow({ status: "published", createdBy: "admin-1" });
      db._tx._queueResolve("returning", [created]);

      const out = await service.createDoctor("admin-1", {
        name: "김명의",
        slug: "kim-myeongui",
        status: "published",
      } as never);

      const insertedValues = db._tx.values.mock.calls[0][0];
      expect(insertedValues.createdBy).toBe("admin-1");
      expect(insertedValues.updatedBy).toBe("admin-1");
      expect(insertedValues.publishedAt).toBeInstanceOf(Date);
      expect(out.id).toBe(created.id);
    });

    it("maps a unique-violation to a 409 ConflictException", async () => {
      db.transaction.mockRejectedValueOnce({ code: "23505" });
      await expect(
        service.createDoctor("admin-1", { name: "x", slug: "dup", status: "draft" } as never),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("changeDoctorStatus", () => {
    it("loads the record then publishes it", async () => {
      const current = makeDoctorRow({ status: "draft", publishedAt: null });
      db._queueResolve("limit", [current]); // requireDoctor terminal
      db._queueResolve("returning", [makeDoctorRow({ status: "published" })]);

      const out = await service.changeDoctorStatus("admin-1", current.id, "published");

      const patch = db.set.mock.calls[0][0];
      expect(patch.status).toBe("published");
      expect(patch.publishedAt).toBeInstanceOf(Date);
      expect(patch.updatedBy).toBe("admin-1");
      expect(out.status).toBe("published");
    });

    it("throws NotFound when the doctor is absent", async () => {
      db._queueResolve("limit", []); // requireDoctor finds nothing
      await expect(
        service.changeDoctorStatus("admin-1", "missing", "archived"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("deleteDoctor", () => {
    it("soft-deletes and returns the id", async () => {
      db._queueResolve("limit", [makeDoctorRow()]);
      const out = await service.deleteDoctor("admin-1", "11111111-1111-1111-1111-111111111111");
      const patch = db.set.mock.calls[0][0];
      expect(patch.isDeleted).toBe(true);
      expect(patch.deletedAt).toBeInstanceOf(Date);
      expect(out).toEqual({ success: true, id: "11111111-1111-1111-1111-111111111111" });
    });
  });

  // ---- FR-005 profile create ------------------------------------------------

  describe("createDoctorCredential", () => {
    it("requires the parent doctor then inserts with doctorId + initial state", async () => {
      db._queueResolve("limit", [makeDoctorRow()]); // requireDoctor terminal
      db._queueResolve("returning", [makeCredentialRow()]);

      const out = await service.createDoctorCredential("admin-1", makeDoctorRow().id, {
        kind: "education",
        title: "서울대학교 의과대학",
        sortOrder: 0,
        isVisible: true,
      } as never);

      const inserted = db.values.mock.calls[0][0];
      expect(inserted.doctorId).toBe(makeDoctorRow().id);
      expect(inserted.kind).toBe("education");
      // admin response carries the editorial isVisible flag
      expect(out).toMatchObject({ title: "서울대학교 의과대학", isVisible: true });
    });

    it("throws NotFound when the doctor is absent", async () => {
      db._queueResolve("limit", []); // requireDoctor finds nothing
      await expect(
        service.createDoctorCredential("admin-1", "missing", {
          kind: "career",
          title: "x",
          sortOrder: 0,
          isVisible: true,
        } as never),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("addHospitalSpecialty", () => {
    it("checks hospital + specialty then links them", async () => {
      db._queueResolve("limit", [makeHospitalRow()]); // requireHospital
      db._queueResolve("limit", [{ id: "spec-1", isActive: true }]); // requireSpecialty
      db._queueResolve("returning", [
        { hospitalId: makeHospitalRow().id, specialtyId: "spec-1", sortOrder: 2 },
      ]);

      const out = await service.addHospitalSpecialty("admin-1", makeHospitalRow().id, {
        specialtyId: "spec-1",
        sortOrder: 2,
      } as never);

      expect(out).toEqual({
        hospitalId: makeHospitalRow().id,
        specialtyId: "spec-1",
        sortOrder: 2,
      });
    });

    it("maps a duplicate department to a 409", async () => {
      db._queueResolve("limit", [makeHospitalRow()]); // requireHospital
      db._queueResolve("limit", [{ id: "spec-1", isActive: true }]); // requireSpecialty
      db.returning.mockRejectedValueOnce({ code: "23505" });

      await expect(
        service.addHospitalSpecialty("admin-1", makeHospitalRow().id, {
          specialtyId: "spec-1",
          sortOrder: 0,
        } as never),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("throws NotFound when the specialty is absent", async () => {
      db._queueResolve("limit", [makeHospitalRow()]); // requireHospital
      db._queueResolve("limit", []); // requireSpecialty finds nothing
      await expect(
        service.addHospitalSpecialty("admin-1", makeHospitalRow().id, {
          specialtyId: "missing",
          sortOrder: 0,
        } as never),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("addHospitalHours", () => {
    it("requires the hospital then inserts a weekday entry", async () => {
      db._queueResolve("limit", [makeHospitalRow()]); // requireHospital
      db._queueResolve("returning", [makeHoursRow()]);

      const out = await service.addHospitalHours("admin-1", makeHospitalRow().id, {
        dayOfWeek: 1,
        opensAt: "09:00",
        closesAt: "18:00",
        isClosed: false,
      } as never);

      const inserted = db.values.mock.calls[0][0];
      expect(inserted.hospitalId).toBe(makeHospitalRow().id);
      expect(out).toMatchObject({ dayOfWeek: 1, opensAt: "09:00", closesAt: "18:00" });
    });

    it("maps a duplicate weekday to a 409", async () => {
      db._queueResolve("limit", [makeHospitalRow()]); // requireHospital
      db.returning.mockRejectedValueOnce({ code: "23505" });
      await expect(
        service.addHospitalHours("admin-1", makeHospitalRow().id, {
          dayOfWeek: 1,
          isClosed: true,
        } as never),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("getDoctorBySlug — profile consistency", () => {
    it("includes only visible credentials, ordered, with the admin flag stripped", async () => {
      db.query.serviceDoctors.findFirst.mockResolvedValue({
        ...makeDoctorRow(),
        region: null,
        specialties: [],
        hospitals: [],
        credentials: [
          makeCredentialRow({ kind: "career", title: "B", sortOrder: 1 }),
          makeCredentialRow({ kind: "career", title: "A", sortOrder: 0 }),
          makeCredentialRow({ kind: "award", title: "hidden", isVisible: false }),
        ],
      });

      const detail = await service.getDoctorBySlug("kim-myeongui");

      // hidden entry dropped; remaining sorted by kind then sortOrder
      expect(detail.credentials.map((c) => c.title)).toEqual(["A", "B"]);
      expect(detail.credentials[0]).not.toHaveProperty("isVisible");
    });
  });

  describe("getHospitalBySlug — profile consistency", () => {
    it("includes active departments (ordered) and weekday hours (by day)", async () => {
      db.query.serviceHospitals.findFirst.mockResolvedValue({
        ...makeHospitalRow(),
        region: null,
        doctors: [],
        specialties: [
          {
            sortOrder: 1,
            specialty: {
              id: "s2",
              name: "내과",
              slug: "im",
              description: null,
              sortOrder: 0,
              isActive: true,
            },
          },
          {
            sortOrder: 0,
            specialty: {
              id: "s1",
              name: "정형외과",
              slug: "os",
              description: null,
              sortOrder: 0,
              isActive: true,
            },
          },
          {
            sortOrder: 2,
            specialty: {
              id: "s3",
              name: "비활성",
              slug: "x",
              description: null,
              sortOrder: 0,
              isActive: false,
            },
          },
        ],
        hours: [makeHoursRow({ dayOfWeek: 3 }), makeHoursRow({ dayOfWeek: 1 })],
      });

      const detail = await service.getHospitalBySlug("seoul-hospital");

      // inactive specialty filtered; remaining ordered by link sortOrder
      expect(detail.specialties.map((s) => s.slug)).toEqual(["os", "im"]);
      expect(detail.hours.map((h) => h.dayOfWeek)).toEqual([1, 3]);
    });
  });
});

function makeCredentialRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    createdAt: new Date("2026-01-02T00:00:00.000Z"),
    updatedAt: new Date("2026-01-03T00:00:00.000Z"),
    doctorId: "11111111-1111-1111-1111-111111111111",
    kind: "education",
    title: "서울대학교 의과대학",
    organization: null,
    startYear: null,
    endYear: null,
    displayPeriod: null,
    description: null,
    sortOrder: 0,
    isVisible: true,
    ...overrides,
  };
}

function makeHoursRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    createdAt: new Date("2026-01-02T00:00:00.000Z"),
    updatedAt: new Date("2026-01-03T00:00:00.000Z"),
    hospitalId: "55555555-5555-5555-5555-555555555555",
    dayOfWeek: 1,
    opensAt: "09:00",
    closesAt: "18:00",
    isClosed: false,
    note: null,
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
    regionId: null,
    addressLine: null,
    phone: null,
    websiteUrl: null,
    photoUrl: null,
    ratingAvg: 4.5,
    reviewCount: 5,
    isFeatured: false,
    status: "published",
    businessRegistrationNo: "123-45-67890",
    internalNotes: null,
    sourceUrl: null,
    publishedAt: null,
    createdBy: null,
    updatedBy: null,
    ...overrides,
  };
}
