/**
 * Super User Seed Script
 *
 * Better Auth signUpEmail API 를 사용하여 슈퍼 계정을 생성한다.
 * 이미 존재하면 skip.
 *
 * Usage:
 *   PRODUCT_BUILDER_SEED_EMAIL=... PRODUCT_BUILDER_SEED_PASSWORD=... PRODUCT_BUILDER_SEED_NAME=... \
 *     pnpm -F server exec tsx src/scripts/seed-super-user.ts
 */

import * as path from "node:path";
import * as dotenv from "dotenv";
import postgres from "postgres";

dotenv.config({ path: path.resolve(__dirname, "../../../../.env.local") });

const EMAIL = process.env.PRODUCT_BUILDER_SEED_EMAIL;
const PASSWORD = process.env.PRODUCT_BUILDER_SEED_PASSWORD;
const NAME = process.env.PRODUCT_BUILDER_SEED_NAME || "Super Admin";
const DATABASE_URL = process.env.DATABASE_URL;

if (!EMAIL || !PASSWORD) {
  console.error(
    "[seed-super-user] PRODUCT_BUILDER_SEED_EMAIL / PRODUCT_BUILDER_SEED_PASSWORD required",
  );
  process.exit(1);
}
if (!DATABASE_URL) {
  console.error("[seed-super-user] DATABASE_URL required");
  process.exit(1);
}

// Narrowed locals so the rest of the script sees `string`, not `string | undefined`.
const REQUIRED_EMAIL: string = EMAIL;
const REQUIRED_PASSWORD: string = PASSWORD;
const REQUIRED_DATABASE_URL: string = DATABASE_URL;

async function run() {
  // Better Auth 는 packages/core 에 있으므로 dynamic import
  const { auth } = await import("@repo/core/auth/server");

  console.log(`[seed-super-user] creating: ${REQUIRED_EMAIL}`);

  try {
    const result = await auth.api.signUpEmail({
      body: {
        email: REQUIRED_EMAIL,
        password: REQUIRED_PASSWORD,
        name: NAME,
      },
    });
    console.log("[seed-super-user] ✅ created:", {
      id: result.user?.id,
      email: result.user?.email,
    });
  } catch (err: unknown) {
    const msg = (err as { message?: string } | null)?.message ?? String(err);
    if (msg.includes("already exists") || msg.includes("USER_ALREADY_EXISTS")) {
      console.log("[seed-super-user] already exists, skipping");
    } else {
      console.error("[seed-super-user] ❌ failed:", err);
      process.exitCode = 1;
      return;
    }
  }

  // Verify via direct DB query
  const sql = postgres(REQUIRED_DATABASE_URL, { max: 1 });
  const users = await sql`
    SELECT u.id, u.email, u.name, p.id as profile_id
    FROM users u
    LEFT JOIN profiles p ON p.id = u.id
    WHERE u.email = ${REQUIRED_EMAIL}
  `;
  console.log("[seed-super-user] db state:", users);
  await sql.end();
}

run().catch((err) => {
  console.error("[seed-super-user] fatal:", err);
  process.exit(1);
});
