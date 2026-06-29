/**
 * Mark a seeded user's email as verified.
 *
 * better-auth requires email verification before sign-in on a production
 * server. The super-user seed creates the row via signUpEmail (unverified),
 * so demo deploys need this flag flipped to allow login without a real
 * verification email round-trip.
 *
 * Reads DATABASE_URL + PRODUCT_BUILDER_SEED_EMAIL from the repo-root
 * .env.local (same convention as db-migrate.ts).
 */

import * as path from "node:path";
import * as dotenv from "dotenv";
import postgres from "postgres";

dotenv.config({ path: path.resolve(__dirname, "../../../../.env.local") });

const DATABASE_URL = process.env.DATABASE_URL;
const EMAIL = process.env.PRODUCT_BUILDER_SEED_EMAIL;

if (!DATABASE_URL) {
  console.error("[mark-email-verified] DATABASE_URL is not set");
  process.exit(1);
}
if (!EMAIL) {
  console.error("[mark-email-verified] PRODUCT_BUILDER_SEED_EMAIL is not set");
  process.exit(1);
}

async function main(databaseUrl: string, email: string) {
  const sql = postgres(databaseUrl, { max: 1, prepare: false });
  const updated = await sql`
    UPDATE users SET email_verified = true WHERE email = ${email}
    RETURNING id, email, email_verified
  `;
  console.log("[mark-email-verified] result:", updated);
  await sql.end();
}

main(DATABASE_URL, EMAIL).catch((err) => {
  console.error("[mark-email-verified] fatal:", err);
  process.exit(1);
});
