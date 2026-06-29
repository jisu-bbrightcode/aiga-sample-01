/**
 * FR-004 명의 큐레이션 Seed (PB-FEAT-004 / BBR-522)
 *
 * Seeds a small editorial 명의 curation on top of the PB-DATA-001 catalog:
 *   2 collections (1 featured 기획전 + 1 분야별) · 3 collection items.
 *
 * Prerequisite: run the service-domain seed first
 * (`pnpm --filter @repo/drizzle db:seed:service-domain`) so the referenced
 * doctors/specialties exist. Idempotent: collections upsert on their unique
 * slug, items upsert on their composite PK, so re-running is safe.
 * Run via `pnpm --filter @repo/drizzle db:seed:doctor-curation`.
 */
import * as dotenv from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  serviceDoctorCollectionItems,
  serviceDoctorCollections,
} from "../schema/features/doctor-curation";
import { serviceDoctors, serviceSpecialties } from "../schema/features/service-domain";

dotenv.config({ path: "../../.env.local" });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

type CollectionSeed = {
  slug: string;
  name: string;
  subtitle: string;
  kind: "editorial" | "specialty" | "region";
  specialtySlug: string | null;
  isFeatured: boolean;
  sortOrder: number;
  /** Doctor slugs in editorial rank order, with an optional 선정 이유. */
  items: { doctorSlug: string; note: string }[];
};

const COLLECTIONS: CollectionSeed[] = [
  {
    slug: "2026-korea-myeongui",
    name: "2026 대한민국 명의",
    subtitle: "분야를 대표하는 올해의 명의",
    kind: "editorial",
    specialtySlug: null,
    isFeatured: true,
    sortOrder: 1,
    items: [
      { doctorSlug: "kim-jeongho-ortho", note: "관절·척추 분야 30년 경력의 명의." },
      { doctorSlug: "lee-soyeon-cardio", note: "심부전·부정맥 진료 전문." },
    ],
  },
  {
    slug: "orthopedics-myeongui",
    name: "정형외과 명의",
    subtitle: "관절·척추 분야 추천 명의",
    kind: "specialty",
    specialtySlug: "orthopedics",
    isFeatured: false,
    sortOrder: 2,
    items: [{ doctorSlug: "kim-jeongho-ortho", note: "관절·척추 분야 30년 경력의 명의." }],
  },
];

async function seed() {
  if (!DATABASE_URL) throw new Error("DATABASE_URL is required");
  const client = postgres(DATABASE_URL, { max: 1 });
  const db = drizzle(client);

  const idBySlug = async (
    table: typeof serviceSpecialties | typeof serviceDoctors | typeof serviceDoctorCollections,
    slug: string,
  ): Promise<string> => {
    const [row] = await db.select({ id: table.id }).from(table).where(eq(table.slug, slug));
    if (!row) throw new Error(`expected seeded row for slug "${slug}" (run service-domain seed first)`);
    return row.id;
  };

  console.log("Seeding service_doctor_collections (2 rows) + items...");
  for (const c of COLLECTIONS) {
    const specialtyId = c.specialtySlug ? await idBySlug(serviceSpecialties, c.specialtySlug) : null;

    await db
      .insert(serviceDoctorCollections)
      .values({
        slug: c.slug,
        name: c.name,
        subtitle: c.subtitle,
        kind: c.kind,
        specialtyId: specialtyId ?? undefined,
        isFeatured: c.isFeatured,
        sortOrder: c.sortOrder,
        status: "published",
      })
      .onConflictDoNothing({ target: serviceDoctorCollections.slug });

    const collectionId = await idBySlug(serviceDoctorCollections, c.slug);
    let rank = 1;
    for (const item of c.items) {
      const doctorId = await idBySlug(serviceDoctors, item.doctorSlug);
      await db
        .insert(serviceDoctorCollectionItems)
        .values({ collectionId, doctorId, rank, note: item.note })
        .onConflictDoNothing();
      rank += 1;
    }
  }

  const counts = await client`
    SELECT
      (SELECT COUNT(*)::int FROM service_doctor_collections) AS collections,
      (SELECT COUNT(*)::int FROM service_doctor_collection_items) AS collection_items
  `;
  console.log("  [ok]", counts[0]);

  await client.end();
  console.log("Doctor curation seed complete.");
}

seed().catch((err) => {
  console.error("Doctor curation seed failed:", err);
  process.exit(1);
});
