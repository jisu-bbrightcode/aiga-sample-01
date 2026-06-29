/**
 * Payment Catalog Seed
 *
 * Seeds the 11-row catalog (5 plans + 3 top-up packages + 3 model pricing rows)
 * from `docs/superpowers/specs/2026-04-26-payment-system-catalog.json`.
 *
 * Idempotent: every insert uses onConflictDoNothing on the unique slug/key.
 * Run via `pnpm --filter @repo/drizzle db:seed:payment`.
 */
import * as dotenv from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  paymentModelPricing,
  paymentPlans,
  paymentTopUpPackages,
} from "../schema/features/payment";

dotenv.config({ path: "../../.env.local" });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const TRIAL_PLANS = new Set(["pro_monthly", "pro_yearly"]);

const PLANS = [
  {
    slug: "free",
    cycle: "lifetime" as const,
    name: "Free",
    polarProductId: null,
    polarPriceId: null,
    priceCents: 0,
    currency: "USD",
    includedCreditsPerCycle: 50,
    seats: 1,
  },
  {
    slug: "pro_monthly",
    cycle: "monthly" as const,
    name: "Pro · Monthly",
    polarProductId: "9f38c8e4-d920-4e11-818b-d337a2105b24",
    polarPriceId: "844c89a8-c0d6-48b8-9e65-d1ade18d0e14",
    priceCents: 1999,
    currency: "USD",
    includedCreditsPerCycle: 1000,
    seats: 1,
  },
  {
    slug: "pro_yearly",
    cycle: "yearly" as const,
    name: "Pro · Yearly",
    polarProductId: "eab35cc0-59dd-4bd6-8bb2-bbc7d68fb3f3",
    polarPriceId: "141ab4af-8325-4ab3-b2a9-8be0b168a243",
    priceCents: 19999,
    currency: "USD",
    includedCreditsPerCycle: 1000,
    seats: 1,
  },
  {
    slug: "team_monthly",
    cycle: "monthly" as const,
    name: "Team · Monthly",
    polarProductId: "e9bf977a-b1cd-491e-a4b7-65ad1d752217",
    polarPriceId: "40937313-13fa-44be-8181-3ec5ef00b980",
    priceCents: 2999,
    currency: "USD",
    includedCreditsPerCycle: 5000,
    seats: 5,
  },
  {
    slug: "team_yearly",
    cycle: "yearly" as const,
    name: "Team · Yearly",
    polarProductId: "e133140d-965b-4edd-a9c6-9c7e69ca0414",
    polarPriceId: "db39825e-8154-4db0-85e4-470f42f61100",
    priceCents: 29999,
    currency: "USD",
    includedCreditsPerCycle: 5000,
    seats: 5,
  },
];

const TOP_UPS = [
  {
    slug: "topup_1k",
    name: "1,000 Credits",
    polarProductId: "f953d794-a3ef-45f8-8947-cfc323af87b2",
    polarPriceId: "c7f5d39e-3e4a-4da0-a8fd-830bf2152ecd",
    credits: 1000,
    priceCents: 1000,
    currency: "USD",
  },
  {
    slug: "topup_5k",
    name: "5,000 Credits",
    polarProductId: "1d3ac6a7-405f-4069-93f2-ee53dfe34ecb",
    polarPriceId: "ed536dad-bc14-4bdf-a75d-86158c8d13e7",
    credits: 5000,
    priceCents: 4000,
    currency: "USD",
  },
  {
    slug: "topup_20k",
    name: "20,000 Credits",
    polarProductId: "8e074020-43b8-4db0-904a-ae4e7a5daba9",
    polarPriceId: "aea7a6f7-bcda-43d7-97a1-c2b11329bbe0",
    credits: 20000,
    priceCents: 12000,
    currency: "USD",
  },
];

// Anthropic API public list pricing (USD per 1M tokens) — see spec §3.
// Stored as numeric strings to match drizzle numeric(10,4).
const MODEL_PRICING = [
  {
    modelKey: "claude-opus-4.7",
    displayName: "Claude Opus 4.7",
    inputWeightPer1kTokens: "3.0000",
    outputWeightPer1kTokens: "15.0000",
  },
  {
    modelKey: "claude-sonnet-4.6",
    displayName: "Claude Sonnet 4.6",
    inputWeightPer1kTokens: "1.0000",
    outputWeightPer1kTokens: "5.0000",
  },
  {
    modelKey: "claude-haiku-4.5",
    displayName: "Claude Haiku 4.5",
    inputWeightPer1kTokens: "0.2500",
    outputWeightPer1kTokens: "1.2500",
  },
];

async function seed() {
  if (!DATABASE_URL) throw new Error("DATABASE_URL is required");
  const client = postgres(DATABASE_URL, { max: 1 });
  const db = drizzle(client);

  console.log("Seeding payment_plans (5 rows)...");
  for (const p of PLANS) {
    const trialDays = TRIAL_PLANS.has(p.slug) ? 14 : 0;
    await db
      .insert(paymentPlans)
      .values({
        slug: p.slug,
        cycle: p.cycle,
        name: p.name,
        polarProductId: p.polarProductId ?? undefined,
        polarPriceId: p.polarPriceId ?? undefined,
        priceCents: p.priceCents,
        currency: p.currency,
        includedCreditsPerCycle: p.includedCreditsPerCycle,
        seats: p.seats,
        trialDays,
        isActive: true,
      })
      .onConflictDoNothing({ target: paymentPlans.slug });
  }

  console.log("Seeding payment_top_up_packages (3 rows)...");
  for (const t of TOP_UPS) {
    await db
      .insert(paymentTopUpPackages)
      .values({
        slug: t.slug,
        name: t.name,
        polarProductId: t.polarProductId,
        polarPriceId: t.polarPriceId,
        credits: t.credits,
        priceCents: t.priceCents,
        currency: t.currency,
        isActive: true,
      })
      .onConflictDoNothing({ target: paymentTopUpPackages.slug });
  }

  console.log("Seeding payment_model_pricing (3 rows)...");
  for (const m of MODEL_PRICING) {
    await db
      .insert(paymentModelPricing)
      .values({
        modelKey: m.modelKey,
        displayName: m.displayName,
        inputWeightPer1kTokens: m.inputWeightPer1kTokens,
        outputWeightPer1kTokens: m.outputWeightPer1kTokens,
        isActive: true,
      })
      .onConflictDoNothing({ target: paymentModelPricing.modelKey });
  }

  // Verify counts
  const planCount = await client`SELECT COUNT(*)::int AS c FROM payment_plans`;
  const topUpCount = await client`SELECT COUNT(*)::int AS c FROM payment_top_up_packages`;
  const pricingCount = await client`SELECT COUNT(*)::int AS c FROM payment_model_pricing`;

  console.log(
    `  [ok] payment_plans=${planCount[0].c} top_ups=${topUpCount[0].c} model_pricing=${pricingCount[0].c}`,
  );

  await client.end();
  console.log("Payment catalog seed complete.");
}

seed().catch((err) => {
  console.error("Payment catalog seed failed:", err);
  process.exit(1);
});
