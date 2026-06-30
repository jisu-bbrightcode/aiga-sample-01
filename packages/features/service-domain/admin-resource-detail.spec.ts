import type {
  ServiceDoctor,
  ServiceDoctorCredential,
  ServiceHospital,
  ServiceHospitalHours,
  ServiceRegion,
  ServiceSpecialty,
} from "@repo/drizzle/schema";
import {
  type DoctorDetailInput,
  type HospitalDetailInput,
  maskSecret,
  toAdminDoctorDetail,
  toAdminHospitalDetail,
} from "./admin-resource-detail";

// ---------------------------------------------------------------------------
// Test fixtures — minimal-but-typed rows (casts narrow the noise of full rows).
// ---------------------------------------------------------------------------

const region = { id: "r1", name: "서울", slug: "seoul" } as unknown as ServiceRegion;

const specialty = (over: Partial<ServiceSpecialty> = {}): ServiceSpecialty =>
  ({ id: "sp1", name: "정형외과", slug: "ortho", ...over }) as unknown as ServiceSpecialty;

const doctorRow = (over: Partial<ServiceDoctor> = {}): ServiceDoctor =>
  ({
    id: "d1",
    name: "김명의",
    slug: "kim",
    title: "정형외과 교수",
    primarySpecialtyId: "sp1",
    primaryHospitalId: "h1",
    regionId: "r1",
    shortBio: "짧은 소개",
    biography: "긴 소개",
    photoUrl: "https://img/p.jpg",
    yearsExperience: 20,
    ratingAvg: 4.8,
    reviewCount: 120,
    isFeatured: true,
    featuredRank: 1,
    status: "draft",
    licenseNumber: "MD-2024-987654",
    licenseVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
    internalNotes: "내부 메모",
    sourceUrl: "https://internal/source",
    publishedAt: null,
    createdBy: "user-creator",
    updatedBy: "user-editor",
    isDeleted: false,
    deletedAt: null,
    createdAt: new Date("2026-05-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-30T04:00:00.000Z"),
    ...over,
  }) as unknown as ServiceDoctor;

const hospitalRow = (over: Partial<ServiceHospital> = {}): ServiceHospital =>
  ({
    id: "h1",
    name: "서울병원",
    slug: "seoul-hosp",
    summary: "요약",
    description: "설명",
    regionId: "r1",
    addressLine: "서울시 어딘가",
    phone: "02-123-4567",
    websiteUrl: "https://hosp",
    photoUrl: "https://img/h.jpg",
    ratingAvg: 4.5,
    reviewCount: 50,
    isFeatured: false,
    status: "published",
    businessRegistrationNo: "123-45-67890",
    internalNotes: "병원 내부 메모",
    sourceUrl: "https://internal/h",
    publishedAt: new Date("2026-04-01T00:00:00.000Z"),
    createdBy: "user-creator",
    updatedBy: "user-editor",
    isDeleted: false,
    deletedAt: null,
    createdAt: new Date("2026-03-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-20T00:00:00.000Z"),
    ...over,
  }) as unknown as ServiceHospital;

const credential = (over: Partial<ServiceDoctorCredential> = {}): ServiceDoctorCredential =>
  ({
    id: "c1",
    doctorId: "d1",
    kind: "career",
    title: "진료부장",
    organization: "서울병원",
    startYear: 2010,
    endYear: null,
    displayPeriod: "2010~현재",
    description: null,
    isVisible: true,
    sortOrder: 0,
    createdAt: null,
    updatedAt: null,
    ...over,
  }) as unknown as ServiceDoctorCredential;

const hours = (over: Partial<ServiceHospitalHours> = {}): ServiceHospitalHours =>
  ({
    id: "hr1",
    hospitalId: "h1",
    dayOfWeek: 1,
    opensAt: "09:00",
    closesAt: "18:00",
    isClosed: false,
    note: null,
    createdAt: null,
    updatedAt: null,
    ...over,
  }) as unknown as ServiceHospitalHours;

describe("maskSecret", () => {
  it("returns null for null/undefined/blank", () => {
    expect(maskSecret(null)).toBeNull();
    expect(maskSecret(undefined)).toBeNull();
    expect(maskSecret("   ")).toBeNull();
  });

  it("fully masks values of 4 chars or fewer (no tail leak)", () => {
    expect(maskSecret("12")).toBe("••");
    expect(maskSecret("1234")).toBe("••••");
  });

  it("reveals only the last 4 chars for longer values", () => {
    expect(maskSecret("MD-2024-987654")).toBe("••••••••••7654");
    expect(maskSecret("123-45-67890")).toBe("••••••••7890");
  });

  it("never leaks the leading characters of the original", () => {
    const masked = maskSecret("SUPER-SECRET-LICENSE-0001");
    expect(masked).not.toContain("SUPER");
    expect(masked).not.toContain("SECRET");
    expect(masked?.endsWith("0001")).toBe(true);
  });
});

describe("toAdminDoctorDetail", () => {
  const input: DoctorDetailInput = {
    doctor: doctorRow(),
    region,
    primarySpecialty: specialty(),
    specialties: [specialty(), specialty({ id: "sp2", name: "내과", slug: "internal" })],
    hospitals: [
      { hospital: hospitalRow(), role: "진료부장", isPrimary: true },
      {
        hospital: hospitalRow({ id: "h2", name: "분당병원", slug: "bundang", status: "archived" }),
        role: null,
        isPrimary: false,
      },
    ],
    credentials: [credential(), credential({ id: "c2", isVisible: false, sortOrder: 1 })],
  };

  it("masks the license number and never carries the raw value", () => {
    const detail = toAdminDoctorDetail(input);
    expect(detail.sensitive.licenseNumber).toBe("••••••••••7654");
    expect(JSON.stringify(detail)).not.toContain("MD-2024-987654");
  });

  it("exposes operational fields for the admin view", () => {
    const detail = toAdminDoctorDetail(input);
    expect(detail.status).toBe("draft");
    expect(detail.ops).toEqual({
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-06-30T04:00:00.000Z",
      publishedAt: null,
      isDeleted: false,
      deletedAt: null,
      createdBy: "user-creator",
      updatedBy: "user-editor",
      sourceUrl: "https://internal/source",
      internalNotes: "내부 메모",
    });
  });

  it("resolves related entities (region, specialties, affiliations, credentials)", () => {
    const detail = toAdminDoctorDetail(input);
    expect(detail.region).toEqual({ id: "r1", name: "서울", slug: "seoul" });
    expect(detail.primarySpecialty).toEqual({ id: "sp1", name: "정형외과", slug: "ortho" });
    expect(detail.specialties).toHaveLength(2);
    expect(detail.hospitals).toEqual([
      {
        id: "h1",
        name: "서울병원",
        slug: "seoul-hosp",
        status: "published",
        role: "진료부장",
        isPrimary: true,
      },
      {
        id: "h2",
        name: "분당병원",
        slug: "bundang",
        status: "archived",
        role: null,
        isPrimary: false,
      },
    ]);
    // admin sees invisible credentials too (unlike the public profile)
    expect(detail.credentials.map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(detail.credentials[1]?.isVisible).toBe(false);
  });

  it("includes a deleted record's soft-delete bookkeeping", () => {
    const detail = toAdminDoctorDetail({
      ...input,
      doctor: doctorRow({ isDeleted: true, deletedAt: new Date("2026-06-29T00:00:00.000Z") }),
    });
    expect(detail.ops.isDeleted).toBe(true);
    expect(detail.ops.deletedAt).toBe("2026-06-29T00:00:00.000Z");
  });
});

describe("toAdminHospitalDetail", () => {
  const input: HospitalDetailInput = {
    hospital: hospitalRow(),
    region,
    specialties: [specialty()],
    doctors: [doctorRow(), doctorRow({ id: "d2", name: "이의사", slug: "lee", status: "draft" })],
    hours: [hours(), hours({ id: "hr2", dayOfWeek: 2 })],
  };

  it("masks the business registration number and never carries the raw value", () => {
    const detail = toAdminHospitalDetail(input);
    expect(detail.sensitive.businessRegistrationNo).toBe("••••••••7890");
    expect(JSON.stringify(detail)).not.toContain("123-45-67890");
  });

  it("exposes operational fields + related doctors/specialties/hours", () => {
    const detail = toAdminHospitalDetail(input);
    expect(detail.status).toBe("published");
    expect(detail.ops.internalNotes).toBe("병원 내부 메모");
    expect(detail.ops.publishedAt).toBe("2026-04-01T00:00:00.000Z");
    expect(detail.doctors).toEqual([
      { id: "d1", name: "김명의", slug: "kim", status: "draft" },
      { id: "d2", name: "이의사", slug: "lee", status: "draft" },
    ]);
    expect(detail.specialties).toHaveLength(1);
    expect(detail.hours.map((h) => h.dayOfWeek)).toEqual([1, 2]);
  });
});
