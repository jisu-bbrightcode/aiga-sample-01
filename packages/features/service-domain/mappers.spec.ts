import type { ServiceDoctor, ServiceHospital } from "@repo/drizzle/schema";
import {
  toAdminDoctor,
  toAdminHospital,
  toPublicDoctor,
  toPublicHospital,
} from "./mappers";

const DOCTOR_SENSITIVE = [
  "licenseNumber",
  "licenseVerifiedAt",
  "internalNotes",
  "sourceUrl",
  "status",
  "createdBy",
  "updatedBy",
  "deletedAt",
  "isDeleted",
  "publishedAt",
] as const;

const HOSPITAL_SENSITIVE = [
  "businessRegistrationNo",
  "internalNotes",
  "sourceUrl",
  "status",
  "createdBy",
  "updatedBy",
  "deletedAt",
  "isDeleted",
  "publishedAt",
] as const;

const doctorRow: ServiceDoctor = {
  id: "11111111-1111-1111-1111-111111111111",
  createdAt: new Date("2026-01-02T00:00:00.000Z"),
  updatedAt: new Date("2026-01-03T00:00:00.000Z"),
  deletedAt: null,
  isDeleted: false,
  name: "김명의",
  slug: "kim-myeongui",
  title: "정형외과 교수",
  primarySpecialtyId: "22222222-2222-2222-2222-222222222222",
  primaryHospitalId: "33333333-3333-3333-3333-333333333333",
  regionId: "44444444-4444-4444-4444-444444444444",
  shortBio: "짧은 소개",
  biography: "긴 약력",
  photoUrl: "https://cdn.test/p.png",
  yearsExperience: 20,
  ratingAvg: 4.8,
  reviewCount: 120,
  isFeatured: true,
  featuredRank: 1,
  status: "published",
  licenseNumber: "MD-SECRET-0001",
  licenseVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
  internalNotes: "내부 메모 - 노출 금지",
  sourceUrl: "https://internal.test/source",
  publishedAt: new Date("2026-01-04T00:00:00.000Z"),
  createdBy: "user-admin",
  updatedBy: "user-admin",
};

const hospitalRow: ServiceHospital = {
  id: "55555555-5555-5555-5555-555555555555",
  createdAt: new Date("2026-01-02T00:00:00.000Z"),
  updatedAt: new Date("2026-01-03T00:00:00.000Z"),
  deletedAt: null,
  isDeleted: false,
  name: "서울병원",
  slug: "seoul-hospital",
  summary: "요약",
  description: "설명",
  regionId: "44444444-4444-4444-4444-444444444444",
  addressLine: "서울시 강남구",
  phone: "02-000-0000",
  websiteUrl: "https://hospital.test",
  photoUrl: "https://cdn.test/h.png",
  ratingAvg: 4.5,
  reviewCount: 80,
  isFeatured: false,
  status: "published",
  businessRegistrationNo: "123-45-67890",
  internalNotes: "내부 메모",
  sourceUrl: "https://internal.test/h",
  publishedAt: new Date("2026-01-04T00:00:00.000Z"),
  createdBy: "user-admin",
  updatedBy: "user-admin",
};

describe("service-domain public mappers — admin field isolation", () => {
  it("toPublicDoctor never exposes sensitive columns", () => {
    const out = toPublicDoctor(doctorRow);
    for (const key of DOCTOR_SENSITIVE) {
      expect(out).not.toHaveProperty(key);
    }
    expect(out.name).toBe("김명의");
    expect(out.createdAt).toBe("2026-01-02T00:00:00.000Z"); // Date → ISO string
  });

  it("toPublicHospital never exposes sensitive columns", () => {
    const out = toPublicHospital(hospitalRow);
    for (const key of HOSPITAL_SENSITIVE) {
      expect(out).not.toHaveProperty(key);
    }
    expect(out.name).toBe("서울병원");
  });
});

describe("service-domain admin mappers — full record", () => {
  it("toAdminDoctor keeps sensitive columns and normalizes timestamps", () => {
    const out = toAdminDoctor(doctorRow);
    expect(out.licenseNumber).toBe("MD-SECRET-0001");
    expect(out.internalNotes).toBe("내부 메모 - 노출 금지");
    expect(out.publishedAt).toBe("2026-01-04T00:00:00.000Z");
    expect(out.licenseVerifiedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("toAdminHospital keeps the business registration number", () => {
    const out = toAdminHospital(hospitalRow);
    expect(out.businessRegistrationNo).toBe("123-45-67890");
    expect(out).not.toHaveProperty("licenseVerifiedAt");
  });
});
