/**
 * Email template seed runner (PB-NOTI-EMAIL-DATA-001 / BBR-655).
 *
 * Seeds the email template registry with the auth / password / transactional
 * keys defined in `email-templates.catalog.ts`, each with a published v1.
 *
 * Idempotent: templates upsert on their unique `key`, versions upsert on the
 * unique (template_id, version), and `current_version_id` is re-pointed at the
 * v1 row each run — re-running is safe and converges to the same state.
 * Run via `pnpm --filter @repo/drizzle db:seed:email-templates`.
 */
import * as dotenv from "dotenv";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { emailTemplateVersions, emailTemplates } from "../schema/features/email";
import { EMAIL_TEMPLATE_SEEDS, validateEmailTemplateSeeds } from "./email-templates.catalog";

dotenv.config({ path: "../../.env.local" });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

async function seed(): Promise<void> {
  const problems = validateEmailTemplateSeeds();
  if (problems.length > 0) {
    console.error("Email template seed catalog is invalid:");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }

  const client = postgres(DATABASE_URL as string, { max: 1 });
  const db = drizzle(client);

  console.log("Seeding email templates...");

  for (const seedItem of EMAIL_TEMPLATE_SEEDS) {
    // 1) template (upsert on unique key)
    await db
      .insert(emailTemplates)
      .values({
        key: seedItem.key,
        name: seedItem.name,
        description: seedItem.description,
        category: seedItem.category,
      })
      .onConflictDoNothing({ target: emailTemplates.key });

    const [template] = await db
      .select({ id: emailTemplates.id })
      .from(emailTemplates)
      .where(eq(emailTemplates.key, seedItem.key))
      .limit(1);

    if (!template) {
      throw new Error(`Failed to resolve template id for key: ${seedItem.key}`);
    }

    // 2) version v1 (upsert on unique (template_id, version))
    await db
      .insert(emailTemplateVersions)
      .values({
        templateId: template.id,
        version: seedItem.version.version,
        subject: seedItem.version.subject,
        variableSchema: seedItem.version.variableSchema,
        status: "published",
        changelog: seedItem.version.changelog,
        publishedAt: new Date(),
      })
      .onConflictDoNothing({
        target: [emailTemplateVersions.templateId, emailTemplateVersions.version],
      });

    const [version] = await db
      .select({ id: emailTemplateVersions.id })
      .from(emailTemplateVersions)
      .where(
        and(
          eq(emailTemplateVersions.templateId, template.id),
          eq(emailTemplateVersions.version, seedItem.version.version),
        ),
      )
      .limit(1);

    if (!version) {
      throw new Error(`Failed to resolve version id for key: ${seedItem.key}`);
    }

    // 3) point template at the published v1 (idempotent)
    await db
      .update(emailTemplates)
      .set({ currentVersionId: version.id })
      .where(eq(emailTemplates.id, template.id));
  }

  const counts = await client`
    SELECT
      (SELECT COUNT(*)::int FROM email_templates) AS templates,
      (SELECT COUNT(*)::int FROM email_template_versions) AS versions,
      (SELECT COUNT(*)::int FROM email_templates WHERE current_version_id IS NOT NULL) AS with_current
  `;
  console.log("  [ok]", counts[0]);

  await client.end();
  console.log("Email template seed complete.");
}

seed().catch((err) => {
  console.error("Email template seed failed:", err);
  process.exit(1);
});
