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
  serviceDoctorCredentials,
  serviceDoctorHospitals,
  serviceDoctorSpecialties,
  serviceDoctors,
  serviceHospitalHours,
  serviceHospitalSpecialties,
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

// FR-005 의사 프로필 이력 (credentials), keyed by doctor slug.
type CredentialKind = "education" | "career" | "certification" | "award";
const CREDENTIALS: Record<
  string,
  {
    kind: CredentialKind;
    title: string;
    organization?: string;
    startYear?: number;
    endYear?: number;
    displayPeriod?: string;
    sortOrder: number;
  }[]
> = {
  "kim-jeongho-ortho": [
    { kind: "education", title: "서울대학교 의과대학 의학박사", organization: "서울대학교", startYear: 1988, endYear: 1994, displayPeriod: "1988–1994", sortOrder: 1 },
    { kind: "career", title: "정형외과 교수", organization: "서울중앙메디컬센터", startYear: 2005, displayPeriod: "2005–현재", sortOrder: 1 },
    { kind: "certification", title: "정형외과 전문의", organization: "대한정형외과학회", startYear: 1999, displayPeriod: "1999", sortOrder: 1 },
    { kind: "award", title: "올해의 명의 (관절·척추)", organization: "대한의사협회", startYear: 2021, displayPeriod: "2021", sortOrder: 1 },
  ],
  "lee-soyeon-cardio": [
    { kind: "education", title: "연세대학교 의과대학 의학석사", organization: "연세대학교", startYear: 2000, endYear: 2006, displayPeriod: "2000–2006", sortOrder: 1 },
    { kind: "career", title: "심장내과 과장", organization: "서울중앙메디컬센터", startYear: 2014, displayPeriod: "2014–현재", sortOrder: 1 },
    { kind: "certification", title: "내과 전문의", organization: "대한내과학회", startYear: 2010, displayPeriod: "2010", sortOrder: 1 },
  ],
  "park-minsu-derma": [
    { kind: "education", title: "고려대학교 의과대학 학사", organization: "고려대학교", startYear: 2003, endYear: 2009, displayPeriod: "2003–2009", sortOrder: 1 },
    { kind: "career", title: "피부과 원장", organization: "송파웰니스병원", startYear: 2016, displayPeriod: "2016–현재", sortOrder: 1 },
  ],
};

// FR-006 병원 진료과목 (departments), keyed by hospital slug → specialty slugs.
const HOSPITAL_SPECIALTIES: Record<string, string[]> = {
  "seoul-central-medical": ["orthopedics", "cardiology", "neurosurgery"],
  "songpa-wellness-hospital": ["dermatology", "family-medicine"],
};

// FR-006 병원 운영시간 (weekly hours), keyed by hospital slug.
// dayOfWeek: 0 = Sun … 6 = Sat. Weekdays 09:00–18:00, Sat varies, Sun closed.
const WEEKDAY = { opensAt: "09:00", closesAt: "18:00", note: "점심시간 13:00–14:00" };
const HOSPITAL_HOURS: Record<
  string,
  { dayOfWeek: number; opensAt?: string; closesAt?: string; isClosed?: boolean; note?: string }[]
> = {
  "seoul-central-medical": [
    { dayOfWeek: 1, ...WEEKDAY },
    { dayOfWeek: 2, ...WEEKDAY },
    { dayOfWeek: 3, ...WEEKDAY },
    { dayOfWeek: 4, ...WEEKDAY },
    { dayOfWeek: 5, ...WEEKDAY },
    { dayOfWeek: 6, opensAt: "09:00", closesAt: "13:00" },
    { dayOfWeek: 0, isClosed: true },
  ],
  "songpa-wellness-hospital": [
    { dayOfWeek: 1, ...WEEKDAY },
    { dayOfWeek: 2, ...WEEKDAY },
    { dayOfWeek: 3, ...WEEKDAY },
    { dayOfWeek: 4, ...WEEKDAY },
    { dayOfWeek: 5, ...WEEKDAY },
    { dayOfWeek: 6, isClosed: true },
    { dayOfWeek: 0, isClosed: true },
  ],
};

type ServiceDb = ReturnType<typeof drizzle>;
type IdBySlug = (
  table:
    | typeof serviceSpecialties
    | typeof serviceRegions
    | typeof serviceHospitals
    | typeof serviceDoctors,
  slug: string,
) => Promise<string>;

// FR-005 의사 프로필 이력. Idempotent per doctor: skip when any credential already
// exists (the table has no natural unique key, so we guard on presence).
async function seedDoctorCredentials(db: ServiceDb, idBySlug: IdBySlug): Promise<void> {
  console.log("Seeding service_doctor_credentials (idempotent per doctor)...");
  for (const [doctorSlug, entries] of Object.entries(CREDENTIALS)) {
    const doctorId = await idBySlug(serviceDoctors, doctorSlug);
    const existing = await db
      .select({ id: serviceDoctorCredentials.id })
      .from(serviceDoctorCredentials)
      .where(eq(serviceDoctorCredentials.doctorId, doctorId));
    if (existing.length > 0) continue;
    for (const c of entries) {
      await db.insert(serviceDoctorCredentials).values({
        doctorId,
        kind: c.kind,
        title: c.title,
        organization: c.organization,
        startYear: c.startYear,
        endYear: c.endYear,
        displayPeriod: c.displayPeriod,
        sortOrder: c.sortOrder,
      });
    }
  }
}

// FR-006 병원 진료과목 (departments) — M:N on composite PK.
async function seedHospitalSpecialties(db: ServiceDb, idBySlug: IdBySlug): Promise<void> {
  console.log("Seeding service_hospital_specialties...");
  for (const [hospitalSlug, specialtySlugs] of Object.entries(HOSPITAL_SPECIALTIES)) {
    const hospitalId = await idBySlug(serviceHospitals, hospitalSlug);
    let order = 1;
    for (const specialtySlug of specialtySlugs) {
      const specialtyId = await idBySlug(serviceSpecialties, specialtySlug);
      await db
        .insert(serviceHospitalSpecialties)
        .values({ hospitalId, specialtyId, sortOrder: order++ })
        .onConflictDoNothing();
    }
  }
}

// FR-006 병원 운영시간 (weekly hours) — one row per (hospital, weekday).
async function seedHospitalHours(db: ServiceDb, idBySlug: IdBySlug): Promise<void> {
  console.log("Seeding service_hospital_hours...");
  for (const [hospitalSlug, days] of Object.entries(HOSPITAL_HOURS)) {
    const hospitalId = await idBySlug(serviceHospitals, hospitalSlug);
    for (const h of days) {
      await db
        .insert(serviceHospitalHours)
        .values({
          hospitalId,
          dayOfWeek: h.dayOfWeek,
          opensAt: h.opensAt,
          closesAt: h.closesAt,
          isClosed: h.isClosed ?? false,
          note: h.note,
        })
        .onConflictDoNothing({
          target: [serviceHospitalHours.hospitalId, serviceHospitalHours.dayOfWeek],
        });
    }
  }
}

async function seed() {
  if (!DATABASE_URL) throw new Error("DATABASE_URL is required");
  const client = postgres(DATABASE_URL, { max: 1 });
  const db = drizzle(client);

  const idBySlug: IdBySlug = async (table, slug) => {
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

  await seedDoctorCredentials(db, idBySlug);
  await seedHospitalSpecialties(db, idBySlug);
  await seedHospitalHours(db, idBySlug);

  const counts = await client`
    SELECT
      (SELECT COUNT(*)::int FROM service_specialties) AS specialties,
      (SELECT COUNT(*)::int FROM service_regions) AS regions,
      (SELECT COUNT(*)::int FROM service_hospitals) AS hospitals,
      (SELECT COUNT(*)::int FROM service_doctors) AS doctors,
      (SELECT COUNT(*)::int FROM service_doctor_specialties) AS doctor_specialties,
      (SELECT COUNT(*)::int FROM service_doctor_hospitals) AS doctor_hospitals,
      (SELECT COUNT(*)::int FROM service_doctor_credentials) AS doctor_credentials,
      (SELECT COUNT(*)::int FROM service_hospital_specialties) AS hospital_specialties,
      (SELECT COUNT(*)::int FROM service_hospital_hours) AS hospital_hours
  `;
  console.log("  [ok]", counts[0]);

  await client.end();
  console.log("Service domain seed complete.");
}

seed().catch((err) => {
  console.error("Service domain seed failed:", err);
  process.exit(1);
});
