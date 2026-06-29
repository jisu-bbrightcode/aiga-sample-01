/**
 * Idempotent applier for settings redesign migrations 0016/0017/0018.
 *
 * The drizzle migrator chokes on the manual journal entries we wrote
 * (snapshot mismatch). This script reads each SQL file and runs it in a
 * single transaction, skipping any DDL whose target already exists.
 *
 * Safe to re-run.
 */
import * as path from "node:path";
import * as dotenv from "dotenv";
import postgres from "postgres";

dotenv.config({ path: path.resolve(__dirname, "../../../../.env.local") });

const DATABASE_URL_RAW = process.env.DATABASE_URL;
if (!DATABASE_URL_RAW) {
  console.error("[apply] DATABASE_URL is not set");
  process.exit(1);
}
const DATABASE_URL: string = DATABASE_URL_RAW;

const sql = postgres(DATABASE_URL, { max: 1, ssl: "require" });

async function tableHasColumn(table: string, column: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_name = ${table} AND column_name = ${column}
    LIMIT 1
  `;
  return rows.length > 0;
}

async function tableExists(table: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM information_schema.tables
    WHERE table_name = ${table} AND table_schema = 'public'
    LIMIT 1
  `;
  return rows.length > 0;
}

async function typeExists(type: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM pg_type WHERE typname = ${type} LIMIT 1
  `;
  return rows.length > 0;
}

async function constraintExists(name: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM pg_constraint WHERE conname = ${name} LIMIT 1
  `;
  return rows.length > 0;
}

async function indexExists(name: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1 FROM pg_indexes WHERE indexname = ${name} LIMIT 1
  `;
  return rows.length > 0;
}

async function step(label: string, fn: () => Promise<boolean>): Promise<void> {
  const skipped = !(await fn());
  console.log(skipped ? `  ⤷ skip  ${label}` : `  ✓ done  ${label}`);
}

async function run() {
  console.log("[apply] target:", new URL(DATABASE_URL).host);

  // ---------------- 0016 — profiles.handle / bio ----------------
  console.log("\n0016_settings_profile_handle_bio");
  await step("profiles.handle column", async () => {
    if (await tableHasColumn("profiles", "handle")) return false;
    await sql`ALTER TABLE "profiles" ADD COLUMN "handle" text`;
    return true;
  });
  await step("profiles.bio column", async () => {
    if (await tableHasColumn("profiles", "bio")) return false;
    await sql`ALTER TABLE "profiles" ADD COLUMN "bio" text`;
    return true;
  });
  await step("profiles_handle_unique constraint", async () => {
    if (await constraintExists("profiles_handle_unique")) return false;
    await sql`ALTER TABLE "profiles" ADD CONSTRAINT "profiles_handle_unique" UNIQUE("handle")`;
    return true;
  });

  // ---------------- 0017 — project visibility / starred / members + story_tags.description ----------------
  console.log("\n0017_settings_project_visibility_starred_members");
  await step("project_visibility enum", async () => {
    if (await typeExists("project_visibility")) return false;
    await sql`CREATE TYPE "public"."project_visibility" AS ENUM('private', 'org', 'public')`;
    return true;
  });
  await step("project_projects.handle column", async () => {
    if (await tableHasColumn("project_projects", "handle")) return false;
    await sql`ALTER TABLE "project_projects" ADD COLUMN "handle" varchar(64)`;
    return true;
  });
  await step("project_projects.visibility column", async () => {
    if (await tableHasColumn("project_projects", "visibility")) return false;
    await sql`ALTER TABLE "project_projects" ADD COLUMN "visibility" "project_visibility" DEFAULT 'private' NOT NULL`;
    return true;
  });
  await step("story_tags.description column", async () => {
    if (await tableHasColumn("story_tags", "description")) return false;
    await sql`ALTER TABLE "story_tags" ADD COLUMN "description" text`;
    return true;
  });
  await step("project_starred table", async () => {
    if (await tableExists("project_starred")) return false;
    await sql`
      CREATE TABLE "project_starred" (
        "user_id" text NOT NULL,
        "project_id" uuid NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "project_starred_user_id_project_id_pk" PRIMARY KEY("user_id","project_id"),
        CONSTRAINT "project_starred_user_id_profiles_id_fk"
          FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade,
        CONSTRAINT "project_starred_project_id_project_projects_id_fk"
          FOREIGN KEY ("project_id") REFERENCES "public"."project_projects"("id") ON DELETE cascade
      )`;
    return true;
  });
  await step("project_members table", async () => {
    if (await tableExists("project_members")) return false;
    await sql`
      CREATE TABLE "project_members" (
        "project_id" uuid NOT NULL,
        "user_id" text NOT NULL,
        "role" varchar(32) DEFAULT 'member' NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "project_members_project_id_user_id_pk" PRIMARY KEY("project_id","user_id"),
        CONSTRAINT "project_members_project_id_project_projects_id_fk"
          FOREIGN KEY ("project_id") REFERENCES "public"."project_projects"("id") ON DELETE cascade,
        CONSTRAINT "project_members_user_id_profiles_id_fk"
          FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade
      )`;
    return true;
  });

  // ---------------- 0018 — project handle backfill ----------------
  console.log("\n0018_settings_project_handle_backfill");
  await step("backfill project_projects.handle", async () => {
    const [r] =
      await sql`SELECT COUNT(*)::int AS n FROM "project_projects" WHERE "handle" IS NULL OR "handle" = ''`;
    if (!r || r.n === 0) return false;
    await sql`
      UPDATE "project_projects"
      SET "handle" = (
        LEFT(
          regexp_replace(
            regexp_replace(LOWER("name"), '[^a-z0-9]+', '-', 'g'),
            '^-+|-+$', '', 'g'
          ),
          32
        )
        || '-' || SUBSTRING("id"::text FROM 1 FOR 6)
      )
      WHERE "handle" IS NULL OR "handle" = ''
    `;
    return true;
  });
  await step("project_projects_owner_handle_idx", async () => {
    if (await indexExists("project_projects_owner_handle_idx")) return false;
    await sql`
      CREATE UNIQUE INDEX "project_projects_owner_handle_idx"
        ON "project_projects" ("owner_id", "handle")
        WHERE "is_deleted" = false
    `;
    return true;
  });

  console.log("\n✅ all settings migrations applied (or skipped if pre-existing)");
  await sql.end();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
