/**
 * FR-001 User Grade Seed (PB-DATA-FR001-001 / BBR-520)
 *
 * Seeds the system 등급 (grade) catalog with per-grade daily usage limits:
 *   guest (5) · basic (20) · verified (100) · premium (unlimited)
 *
 * `guest` exists as a definition so the app can resolve a limit for
 * not-yet-graded / anonymous-equivalent users without a special case; logged-in
 * users get a `user_grades` row pointing at one of these definitions.
 *
 * Idempotent: each insert uses onConflictDoNothing on the unique slug, so
 * re-running is safe. Tuning an existing grade's limit is an admin operation,
 * not a seed concern (seed only guarantees the rows exist).
 * Run via `pnpm --filter @repo/drizzle db:seed:user-grade`.
 */
import * as dotenv from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { userGradeDefinitions } from "../schema/features/user-grade";

dotenv.config({ path: "../../.env.local" });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required (check .env.local)");
}

/**
 * System grades, low → high. `dailyUsageLimit: null` means unlimited.
 * `sortOrder` drives display; `isSystem` protects rows from deletion.
 */
const SYSTEM_GRADES = [
  {
    slug: "guest",
    name: "게스트",
    description: "로그인하지 않은 사용자 기준 한도",
    sortOrder: 0,
    dailyUsageLimit: 5,
  },
  {
    slug: "basic",
    name: "기본 회원",
    description: "소셜 로그인 가입 회원",
    sortOrder: 10,
    dailyUsageLimit: 20,
  },
  {
    slug: "verified",
    name: "인증 회원",
    description: "본인확인(KCB)을 완료한 회원",
    sortOrder: 20,
    dailyUsageLimit: 100,
  },
  {
    slug: "premium",
    name: "프리미엄 회원",
    description: "프리미엄 등급 — 일일 사용 한도 무제한",
    sortOrder: 30,
    dailyUsageLimit: null,
  },
] as const;

async function seed() {
  const client = postgres(DATABASE_URL as string, { max: 1 });
  const db = drizzle(client);

  console.log("Seeding FR-001 user grade catalog...");

  for (const grade of SYSTEM_GRADES) {
    await db
      .insert(userGradeDefinitions)
      .values({
        slug: grade.slug,
        name: grade.name,
        description: grade.description,
        sortOrder: grade.sortOrder,
        dailyUsageLimit: grade.dailyUsageLimit,
        isSystem: true,
        isActive: true,
      })
      .onConflictDoNothing({ target: userGradeDefinitions.slug });
  }

  const counts = await client`
    SELECT
      (SELECT COUNT(*)::int FROM user_grade_definitions) AS grade_definitions
  `;
  console.log("  [ok]", counts[0]);

  await client.end();
  console.log("User grade seed complete.");
}

seed().catch((err) => {
  console.error("User grade seed failed:", err);
  process.exit(1);
});
