/**
 * AIGA 통합검색 Seed (PB-DATA-FR003 / BBR-521)
 *
 * Three parts:
 *  1. Search synonyms — admin-curated query expansions (한국어 의료 동의어).
 *  2. Reindex — projects every *published* service-domain catalog row
 *     (doctors, hospitals, specialties, regions) into service_search_documents.
 *     This is the same projection the runtime reindex job performs; running it
 *     here gives the search surfaces real data to query.
 *  3. (demo) A few popular / zero-result query-log rows so 인기 검색어 and the
 *     admin gap report have something to show. Seeded only when the log is empty.
 *
 * Idempotent: synonyms upsert on `term`; documents upsert on
 * (entity_type, entity_id); query-log demo rows are inserted only on an empty
 * table. Re-running refreshes the projection in place.
 * Run via `pnpm --filter @repo/drizzle db:seed:service-search`
 * (run db:seed:service-domain first so there is a catalog to index).
 */
import * as dotenv from "dotenv";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  serviceDoctors,
  serviceHospitals,
  serviceRegions,
  serviceSpecialties,
} from "../schema/features/service-domain";
import {
  type NewServiceSearchDocument,
  serviceSearchDocuments,
  serviceSearchQueries,
  serviceSearchSynonyms,
} from "../schema/features/service-search";

dotenv.config({ path: "../../.env.local" });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

type Db = ReturnType<typeof drizzle>;

const SYNONYMS = [
  { term: "정형외과", expansions: ["뼈", "관절", "척추", "ortho"], specialtySlug: "orthopedics" },
  { term: "심장내과", expansions: ["심장", "순환기내과", "cardio"], specialtySlug: "cardiology" },
  {
    term: "피부과",
    expansions: ["피부", "아토피", "여드름", "derma"],
    specialtySlug: "dermatology",
  },
  { term: "안과", expansions: ["눈", "시력", "ophthalmology"], specialtySlug: "ophthalmology" },
  { term: "소아과", expansions: ["소아청소년과", "어린이", "pediatrics"], specialtySlug: null },
  {
    term: "건강검진",
    expansions: ["검진", "종합검진", "checkup"],
    specialtySlug: "family-medicine",
  },
];

// Representative search log for the 인기 검색어 widget + admin zero-result report.
const DEMO_QUERIES = [
  { raw: "무릎 관절", results: 3 },
  { raw: "무릎 관절", results: 3 },
  { raw: "강남 정형외과", results: 2 },
  { raw: "심장내과", results: 1 },
  { raw: "피부과 원장", results: 1 },
  { raw: "치과 임플란트", results: 0 }, // zero-result: catalog gap
];

const normalize = (q: string): string => q.trim().toLowerCase().replace(/\s+/g, " ");

const join = (parts: (string | null | undefined)[], sep: string): string | null =>
  parts.filter(Boolean).join(sep) || null;

async function mapById(
  db: Db,
  table: typeof serviceSpecialties | typeof serviceRegions,
): Promise<Map<string, string>> {
  const rows = await db.select({ id: table.id, name: table.name }).from(table);
  return new Map(rows.map((r) => [r.id, r.name]));
}

async function seedSynonyms(db: Db): Promise<void> {
  console.log("Seeding service_search_synonyms...");
  const idBySlug = new Map(
    (
      await db
        .select({ id: serviceSpecialties.id, slug: serviceSpecialties.slug })
        .from(serviceSpecialties)
    ).map((s) => [s.slug, s.id]),
  );
  for (const s of SYNONYMS) {
    const specialtyId = s.specialtySlug ? (idBySlug.get(s.specialtySlug) ?? null) : null;
    await db
      .insert(serviceSearchSynonyms)
      .values({ term: s.term, expansions: s.expansions, specialtyId, isActive: true })
      .onConflictDoUpdate({
        target: serviceSearchSynonyms.term,
        set: { expansions: s.expansions, updatedAt: new Date() },
      });
  }
}

async function doctorDocs(
  db: Db,
  specialtyName: Map<string, string>,
  regionName: Map<string, string>,
): Promise<NewServiceSearchDocument[]> {
  const rows = await db.select().from(serviceDoctors).where(eq(serviceDoctors.status, "published"));
  return rows.map((d) => {
    const specialty = d.primarySpecialtyId ? specialtyName.get(d.primarySpecialtyId) : undefined;
    const region = d.regionId ? regionName.get(d.regionId) : undefined;
    return {
      entityType: "doctor",
      entityId: d.id,
      title: d.name,
      subtitle: join([specialty, region], " · "),
      slug: d.slug,
      photoUrl: d.photoUrl ?? null,
      regionId: d.regionId ?? null,
      specialtyId: d.primarySpecialtyId ?? null,
      ratingAvg: d.ratingAvg,
      body: join([d.shortBio, d.biography], " "),
      keywords: join([d.title, specialty], " "),
      weight: d.isFeatured ? 100 : 0,
      isPublished: true,
      sourceUpdatedAt: d.updatedAt,
    };
  });
}

async function hospitalDocs(
  db: Db,
  regionName: Map<string, string>,
): Promise<NewServiceSearchDocument[]> {
  const rows = await db
    .select()
    .from(serviceHospitals)
    .where(eq(serviceHospitals.status, "published"));
  return rows.map((h) => ({
    entityType: "hospital",
    entityId: h.id,
    title: h.name,
    subtitle: join([h.regionId ? regionName.get(h.regionId) : undefined, h.addressLine], " · "),
    slug: h.slug,
    photoUrl: h.photoUrl ?? null,
    regionId: h.regionId ?? null,
    specialtyId: null,
    ratingAvg: h.ratingAvg,
    body: join([h.summary, h.description], " "),
    keywords: null,
    weight: h.isFeatured ? 100 : 0,
    isPublished: true,
    sourceUpdatedAt: h.updatedAt,
  }));
}

async function taxonomyDocs(db: Db): Promise<NewServiceSearchDocument[]> {
  const specialties = await db
    .select()
    .from(serviceSpecialties)
    .where(eq(serviceSpecialties.isActive, true));
  const regions = await db.select().from(serviceRegions).where(eq(serviceRegions.isActive, true));
  return [
    ...specialties.map((s) => ({
      entityType: "specialty" as const,
      entityId: s.id,
      title: s.name,
      subtitle: "진료과",
      slug: s.slug,
      specialtyId: s.id,
      body: s.description ?? null,
      isPublished: true,
      sourceUpdatedAt: s.updatedAt,
    })),
    ...regions.map((r) => ({
      entityType: "region" as const,
      entityId: r.id,
      title: r.name,
      subtitle: "지역",
      slug: r.slug,
      regionId: r.id,
      isPublished: true,
      sourceUpdatedAt: r.updatedAt,
    })),
  ];
}

async function buildDocuments(db: Db): Promise<NewServiceSearchDocument[]> {
  const specialtyName = await mapById(db, serviceSpecialties);
  const regionName = await mapById(db, serviceRegions);
  return [
    ...(await doctorDocs(db, specialtyName, regionName)),
    ...(await hospitalDocs(db, regionName)),
    ...(await taxonomyDocs(db)),
  ];
}

async function upsertDocuments(db: Db, docs: NewServiceSearchDocument[]): Promise<void> {
  console.log("Reindexing published catalog into service_search_documents...");
  for (const doc of docs) {
    await db
      .insert(serviceSearchDocuments)
      .values(doc)
      .onConflictDoUpdate({
        target: [serviceSearchDocuments.entityType, serviceSearchDocuments.entityId],
        set: {
          title: doc.title,
          subtitle: doc.subtitle ?? null,
          slug: doc.slug,
          photoUrl: doc.photoUrl ?? null,
          regionId: doc.regionId ?? null,
          specialtyId: doc.specialtyId ?? null,
          ratingAvg: doc.ratingAvg ?? 0,
          body: doc.body ?? null,
          keywords: doc.keywords ?? null,
          weight: doc.weight ?? 0,
          isPublished: doc.isPublished ?? true,
          sourceUpdatedAt: doc.sourceUpdatedAt ?? null,
          updatedAt: new Date(),
        },
      });
  }
}

async function seedDemoQueries(db: Db): Promise<void> {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(serviceSearchQueries);
  if (count > 0) {
    console.log(`service_search_queries already has ${count} rows; skipping demo log.`);
    return;
  }
  console.log("Seeding demo service_search_queries (popular + zero-result)...");
  for (const q of DEMO_QUERIES) {
    await db.insert(serviceSearchQueries).values({
      rawQuery: q.raw,
      normalizedQuery: normalize(q.raw),
      resultCount: q.results,
    });
  }
}

async function seed(): Promise<void> {
  if (!DATABASE_URL) throw new Error("DATABASE_URL is required");
  const client = postgres(DATABASE_URL, { max: 1 });
  const db = drizzle(client);

  await seedSynonyms(db);
  await upsertDocuments(db, await buildDocuments(db));
  await seedDemoQueries(db);

  const counts = await client`
    SELECT
      (SELECT COUNT(*)::int FROM service_search_documents) AS documents,
      (SELECT COUNT(*)::int FROM service_search_synonyms) AS synonyms,
      (SELECT COUNT(*)::int FROM service_search_queries) AS queries
  `;
  console.log("  [ok]", counts[0]);

  await client.end();
  console.log("Service search seed complete.");
}

seed().catch((err) => {
  console.error("Service search seed failed:", err);
  process.exit(1);
});
