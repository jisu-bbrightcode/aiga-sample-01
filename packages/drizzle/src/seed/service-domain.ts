/**
 * AIGA Service Domain Seed (PB-DATA-001 / BBR-519)
 *
 * Seeds a small, realistic 의사/병원 큐레이션 catalog:
 *   6 specialties · 3 regions (서울 → 강남구/송파구) · 2 hospitals · 3 doctors
 *   (one featured 명의) · doctor↔specialty / doctor↔hospital links.
 *
 * Idempotent: every catalog insert uses onConflictDoNothing on its unique slug
 * and ids are re-selected by slug for linking, so re-running is safe.
 * Run via `pnpm --filter @repo/drizzle db:seed:service-domain`.
 */
import * as dotenv from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  serviceDoctorHospitals,
  serviceDoctorSpecialties,
  serviceDoctors,
  serviceHospitals,
  serviceRegions,
  serviceSpecialties,
} from "../schema/features/service-domain";

dotenv.config({ path: "../../.env.local" });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const SPECIALTIES = [
  { slug: "orthopedics", name: "정형외과", sortOrder: 1 },
  { slug: "cardiology", name: "심장내과", sortOrder: 2 },
  { slug: "dermatology", name: "피부과", sortOrder: 3 },
  { slug: "neurosurgery", name: "신경외과", sortOrder: 4 },
  { slug: "ophthalmology", name: "안과", sortOrder: 5 },
  { slug: "family-medicine", name: "가정의학과", sortOrder: 6 },
];

const REGIONS = [
  { slug: "seoul", name: "서울특별시", parentSlug: null, sortOrder: 1 },
  { slug: "seoul-gangnam", name: "강남구", parentSlug: "seoul", sortOrder: 1 },
  { slug: "seoul-songpa", name: "송파구", parentSlug: "seoul", sortOrder: 2 },
];

const HOSPITALS = [
  {
    slug: "seoul-central-medical",
    name: "서울중앙메디컬센터",
    summary: "강남 소재 종합 의료기관",
    regionSlug: "seoul-gangnam",
    addressLine: "서울특별시 강남구 테헤란로 100",
    phone: "02-1234-5678",
    isFeatured: true,
  },
  {
    slug: "songpa-wellness-hospital",
    name: "송파웰니스병원",
    summary: "송파 지역 거점 병원",
    regionSlug: "seoul-songpa",
    addressLine: "서울특별시 송파구 올림픽로 200",
    phone: "02-9876-5432",
    isFeatured: false,
  },
];

const DOCTORS = [
  {
    slug: "kim-jeongho-ortho",
    name: "김정호",
    title: "정형외과 교수",
    specialtySlug: "orthopedics",
    hospitalSlug: "seoul-central-medical",
    regionSlug: "seoul-gangnam",
    shortBio: "관절·척추 분야 30년 경력의 명의.",
    yearsExperience: 30,
    isFeatured: true,
    featuredRank: 1,
  },
  {
    slug: "lee-soyeon-cardio",
    name: "이소연",
    title: "심장내과 과장",
    specialtySlug: "cardiology",
    hospitalSlug: "seoul-central-medical",
    regionSlug: "seoul-gangnam",
    shortBio: "심부전·부정맥 진료 전문.",
    yearsExperience: 18,
    isFeatured: false,
    featuredRank: null as number | null,
  },
  {
    slug: "park-minsu-derma",
    name: "박민수",
    title: "피부과 원장",
    specialtySlug: "dermatology",
    hospitalSlug: "songpa-wellness-hospital",
    regionSlug: "seoul-songpa",
    shortBio: "아토피·건선 등 만성 피부질환 진료.",
    yearsExperience: 12,
    isFeatured: false,
    featuredRank: null as number | null,
  },
];

async function seed() {
  if (!DATABASE_URL) throw new Error("DATABASE_URL is required");
  const client = postgres(DATABASE_URL, { max: 1 });
  const db = drizzle(client);

  const idBySlug = async (
    table: typeof serviceSpecialties | typeof serviceRegions | typeof serviceHospitals,
    slug: string,
  ): Promise<string> => {
    const [row] = await db.select({ id: table.id }).from(table).where(eq(table.slug, slug));
    if (!row) throw new Error(`expected seeded row for slug "${slug}"`);
    return row.id;
  };

  console.log("Seeding service_specialties (6 rows)...");
  for (const s of SPECIALTIES) {
    await db
      .insert(serviceSpecialties)
      .values({ slug: s.slug, name: s.name, sortOrder: s.sortOrder, isActive: true })
      .onConflictDoNothing({ target: serviceSpecialties.slug });
  }

  console.log("Seeding service_regions (3 rows, 2-level)...");
  // Parents first so children can resolve parentId.
  for (const r of REGIONS.filter((x) => x.parentSlug === null)) {
    await db
      .insert(serviceRegions)
      .values({ slug: r.slug, name: r.name, sortOrder: r.sortOrder, isActive: true })
      .onConflictDoNothing({ target: serviceRegions.slug });
  }
  for (const r of REGIONS.filter((x) => x.parentSlug !== null)) {
    const parentId = await idBySlug(serviceRegions, r.parentSlug as string);
    await db
      .insert(serviceRegions)
      .values({ slug: r.slug, name: r.name, parentId, sortOrder: r.sortOrder, isActive: true })
      .onConflictDoNothing({ target: serviceRegions.slug });
  }

  console.log("Seeding service_hospitals (2 rows)...");
  for (const h of HOSPITALS) {
    const regionId = await idBySlug(serviceRegions, h.regionSlug);
    await db
      .insert(serviceHospitals)
      .values({
        slug: h.slug,
        name: h.name,
        summary: h.summary,
        regionId,
        addressLine: h.addressLine,
        phone: h.phone,
        isFeatured: h.isFeatured,
        status: "published",
      })
      .onConflictDoNothing({ target: serviceHospitals.slug });
  }

  console.log("Seeding service_doctors (3 rows, 1 featured 명의) + links...");
  for (const d of DOCTORS) {
    const specialtyId = await idBySlug(serviceSpecialties, d.specialtySlug);
    const hospitalId = await idBySlug(serviceHospitals, d.hospitalSlug);
    const regionId = await idBySlug(serviceRegions, d.regionSlug);

    await db
      .insert(serviceDoctors)
      .values({
        slug: d.slug,
        name: d.name,
        title: d.title,
        primarySpecialtyId: specialtyId,
        primaryHospitalId: hospitalId,
        regionId,
        shortBio: d.shortBio,
        yearsExperience: d.yearsExperience,
        isFeatured: d.isFeatured,
        featuredRank: d.featuredRank ?? undefined,
        status: "published",
      })
      .onConflictDoNothing({ target: serviceDoctors.slug });

    const doctorId = await idBySlug(serviceDoctors, d.slug);
    await db
      .insert(serviceDoctorSpecialties)
      .values({ doctorId, specialtyId, isPrimary: true })
      .onConflictDoNothing();
    await db
      .insert(serviceDoctorHospitals)
      .values({ doctorId, hospitalId, role: d.title, isPrimary: true })
      .onConflictDoNothing();
  }

  const counts = await client`
    SELECT
      (SELECT COUNT(*)::int FROM service_specialties) AS specialties,
      (SELECT COUNT(*)::int FROM service_regions) AS regions,
      (SELECT COUNT(*)::int FROM service_hospitals) AS hospitals,
      (SELECT COUNT(*)::int FROM service_doctors) AS doctors,
      (SELECT COUNT(*)::int FROM service_doctor_specialties) AS doctor_specialties,
      (SELECT COUNT(*)::int FROM service_doctor_hospitals) AS doctor_hospitals
  `;
  console.log("  [ok]", counts[0]);

  await client.end();
  console.log("Service domain seed complete.");
}

seed().catch((err) => {
  console.error("Service domain seed failed:", err);
  process.exit(1);
});
