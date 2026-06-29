#!/usr/bin/env tsx

/**
 * Backfill paymentExtraUsageSettings for existing organizations.
 *
 * - row 없는 organization 에만 insert (onConflictDoNothing — 멱등).
 * - active subscription → plan slug 기반 monthly_limit_cents 결정.
 *   pro_*  → 5,000 cents ($50)
 *   team_* → 20,000 cents ($200)
 *   없음   → 0 cents (Free)
 *
 * Usage:
 *   pnpm -F server exec tsx src/scripts/backfill-extra-usage-settings.ts
 */

import * as path from "node:path";
import * as dotenv from "dotenv";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import {
  paymentExtraUsageSettings,
} from "@repo/drizzle";

dotenv.config({ path: path.resolve(__dirname, "../../../../.env.local") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("[backfill-extra-usage-settings] DATABASE_URL required");
  process.exit(1);
}

// narrowed: process.exit above ensures DATABASE_URL is non-null here
const DB_URL: string = DATABASE_URL;

async function main() {
  const sql = postgres(DB_URL, { max: 1 });
  const db = drizzle(sql);

  console.log("[backfill-extra-usage-settings] querying organizations without settings...");

  // raw SQL: LEFT JOIN 으로 settings 없는 org 만 + active sub plan slug 조인
  const rows = await sql<Array<{ id: string; plan_slug: string | null }>>`
    SELECT o.id, p.slug AS plan_slug
    FROM organizations o
    LEFT JOIN payment_subscriptions s
      ON s.organization_id = o.id AND s.status = 'active'
    LEFT JOIN payment_plans p
      ON p.id = s.plan_id
    WHERE NOT EXISTS (
      SELECT 1 FROM payment_extra_usage_settings eus
      WHERE eus.organization_id = o.id
    )
  `;

  console.log(`[backfill-extra-usage-settings] ${rows.length} organizations to backfill`);

  let created = 0;
  for (const row of rows) {
    const monthlyLimitCents = (() => {
      if (!row.plan_slug) return 0;
      if (row.plan_slug.startsWith("pro_")) return 5_000;
      if (row.plan_slug.startsWith("team_")) return 20_000;
      return 0;
    })();

    await db
      .insert(paymentExtraUsageSettings)
      .values({
        organizationId: row.id,
        enabled: false,
        monthlyLimitCents,
        autoRechargeEnabled: false,
        autoRechargeThresholdCents: 500,
        monthlyRechargeCapCount: 5,
      })
      .onConflictDoNothing();

    created += 1;
  }

  console.log(`[backfill-extra-usage-settings] done: ${created} settings rows created`);
  await sql.end();
}

main().catch((err) => {
  console.error("[backfill-extra-usage-settings] fatal:", err);
  process.exit(1);
});
