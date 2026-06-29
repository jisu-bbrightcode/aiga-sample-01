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

  describe("adminListDoctors", () => {
    it("exposes sensitive fields + non-published status to the admin tier with meta", async () => {
      const row = makeDoctorRow({ status: "draft", licenseNumber: "LIC-1" });
      db._queueResolve("offset", [row]); // items terminal
      db._queueResolve("where", [{ count: 1 }]); // count terminal

      const result = await service.adminListDoctors({
        page: 1,
        limit: 20,
        includeDeleted: false,
        sort: "updated",
      } as never);

      expect(result).toMatchObject({ total: 1, page: 1, limit: 20 });
      // admin tier is the opposite of the public list: sensitive columns + status DO surface
      expect(result.items[0]).toMatchObject({ status: "draft", licenseNumber: "LIC-1" });
    });

    it("orders by rating with a createdAt tiebreaker when sort=rating", async () => {
      db._queueResolve("offset", []);
      db._queueResolve("where", [{ count: 0 }]);
      await service.adminListDoctors({
        page: 1,
        limit: 20,
        includeDeleted: false,
        sort: "rating",
      } as never);
      expect(db.orderBy.mock.calls[0]).toHaveLength(2);
    });

    it("orders by name alone when sort=name", async () => {
      db._queueResolve("offset", []);
      db._queueResolve("where", [{ count: 0 }]);
      await service.adminListDoctors({
        page: 1,
        limit: 20,
        includeDeleted: false,
        sort: "name",
      } as never);
      expect(db.orderBy.mock.calls[0]).toHaveLength(1);
    });
  });

  describe("adminListHospitals", () => {
    it("exposes businessRegistrationNo + archived status to the admin tier", async () => {
      const row = makeHospitalRow({ status: "archived" });
      db._queueResolve("offset", [row]);
      db._queueResolve("where", [{ count: 1 }]);

      const result = await service.adminListHospitals({
        page: 2,
        limit: 10,
        includeDeleted: true,
        sort: "updated",
      } as never);

      expect(result).toMatchObject({ total: 1, page: 2, limit: 10 });
      expect(result.items[0]).toMatchObject({
        status: "archived",
        businessRegistrationNo: "123-45-67890",
      });
    });
  });
});

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
