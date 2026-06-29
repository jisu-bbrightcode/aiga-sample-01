/**
 * Payment Schema Invariants — INV-1, INV-3, INV-4 (G1)
 *
 * INV-1 (credit ledger): SUM(delta) per organization === last balance_after
 * INV-3 (coupons): type='percent' ⇒ percent_off ∈ [1,100] AND amount_off_cents IS NULL
 *                  type='amount'  ⇒ amount_off_cents > 0 AND percent_off IS NULL
 * INV-4 (subscription events): polar_event_id is unique
 *
 * Spec: docs/superpowers/specs/2026-04-26-payment-system-design.md §3
 *
 * Each test runs inside a SAVEPOINT/ROLLBACK to keep the database clean.
 */
import { endTestDb, hasDb, withRollback } from "./test-db";

const describeIfDb = hasDb ? describe : describe.skip;

describeIfDb("payment schema invariants", () => {
  afterAll(async () => {
    await endTestDb();
  });

  // tx is the postgres-js TransactionSql tagged-template — typed loosely as
  // the generic shape is awkward to import without parameterization.
  async function makeOrg(tx: any, id: string) {
    await tx`INSERT INTO organizations (id, name, created_at) VALUES (${id}, ${`org-${id}`}, NOW())`;
  }

  // makeUser intentionally not exposed: current invariant tests do not
  // need a user fixture because the FKs they exercise (organization_id)
  // hit organizations only.

  // ──────────────────────────────────────────────────────────────────
  // INV-1: ledger balance_after === SUM(delta)
  // ──────────────────────────────────────────────────────────────────
  it("INV-1: ledger balance_after equals SUM(delta) for the org", async () => {
    await withRollback(async (tx) => {
      const orgId = `inv1-${Date.now()}`;
      await makeOrg(tx, orgId);

      // Row 1: +1000 (top_up)
      await tx`
        INSERT INTO payment_credit_ledger (organization_id, delta, reason, balance_after)
        VALUES (${orgId}, 1000, 'top_up', 1000)
      `;
      // Row 2: -200 (spend) → balance becomes 800
      await tx`
        INSERT INTO payment_credit_ledger (organization_id, delta, reason, balance_after)
        VALUES (${orgId}, -200, 'spend', 800)
      `;

      const sumRow =
        await tx`SELECT COALESCE(SUM(delta), 0)::int AS s FROM payment_credit_ledger WHERE organization_id = ${orgId}`;
      const lastRow = await tx`
        SELECT balance_after FROM payment_credit_ledger
        WHERE organization_id = ${orgId}
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      `;

      expect(sumRow[0].s).toBe(800);
      expect(lastRow[0].balance_after).toBe(800);
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // INV-3: coupon type/value invariant CHECK
  // ──────────────────────────────────────────────────────────────────
  it("INV-3: percent coupon with NULL percent_off is rejected by CHECK", async () => {
    await expect(
      withRollback(async (tx) => {
        // type='percent' but percent_off IS NULL → must violate
        // payment_coupons_type_value_invariant CHECK.
        await tx`
          INSERT INTO payment_coupons (code, type, duration, applies_to)
          VALUES ('TEST_BAD_PERCENT', 'percent', 'once', 'subscription')
        `;
      }),
    ).rejects.toThrow(/payment_coupons_type_value_invariant|check constraint/i);
  });

  it("INV-3: valid percent coupon is accepted", async () => {
    await withRollback(async (tx) => {
      await tx`
        INSERT INTO payment_coupons (code, type, percent_off, duration, applies_to)
        VALUES ('TEST_GOOD_PERCENT', 'percent', 25, 'once', 'subscription')
      `;
      const rows =
        await tx`SELECT code, percent_off FROM payment_coupons WHERE code = 'TEST_GOOD_PERCENT'`;
      expect(rows).toHaveLength(1);
      expect(rows[0].percent_off).toBe(25);
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // INV-4: payment_subscription_events.polar_event_id UNIQUE
  // ──────────────────────────────────────────────────────────────────
  it("INV-4: duplicate polar_event_id violates UNIQUE", async () => {
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    await expect(
      withRollback(async (tx) => {
        await tx`
          INSERT INTO payment_subscription_events (polar_event_id, event_type, payload)
          VALUES (${eventId}, 'subscription.updated', '{}'::jsonb)
        `;
        // Second insert with same polar_event_id must fail.
        await tx`
          INSERT INTO payment_subscription_events (polar_event_id, event_type, payload)
          VALUES (${eventId}, 'subscription.updated', '{}'::jsonb)
        `;
      }),
    ).rejects.toThrow(/unique|polar_event_id/i);
  });

  // ──────────────────────────────────────────────────────────────────
  // INV-5: payment_usage_ledger balance_after_cents = SUM(delta_cents)
  // ──────────────────────────────────────────────────────────────────
  it("INV-5: usage_ledger balance_after_cents equals SUM(delta_cents) for the org", async () => {
    await withRollback(async (tx) => {
      const orgId = `inv5-${Date.now()}`;
      await makeOrg(tx, orgId);

      const periodStart = "2026-04-01T00:00:00Z";
      const periodEnd = "2026-05-01T00:00:00Z";

      // Row 1: +1000 (manual_topup)
      await tx`
        INSERT INTO payment_usage_ledger
          (organization_id, delta_cents, balance_after_cents, reason, ref_type, ref_id, period_start, period_end)
        VALUES
          (${orgId}, 1000, 1000, 'manual_topup', 'manual_admin', ${`inv5_${orgId}_1`}, ${periodStart}, ${periodEnd})
      `;
      // Row 2: -300 (ai_usage) → net = 700
      await tx`
        INSERT INTO payment_usage_ledger
          (organization_id, delta_cents, balance_after_cents, reason, ref_type, ref_id, period_start, period_end)
        VALUES
          (${orgId}, -300, 700, 'ai_usage', 'usage_claim', ${`inv5_${orgId}_2`}, ${periodStart}, ${periodEnd})
      `;

      const sumRow = await tx`
        SELECT COALESCE(SUM(delta_cents), 0)::int AS s
        FROM payment_usage_ledger
        WHERE organization_id = ${orgId}
      `;
      expect(sumRow[0].s).toBe(700);
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // INV-6: payment_recharge_history idempotency_key UNIQUE per org
  // ──────────────────────────────────────────────────────────────────
  it("INV-6: recharge_history idempotency_key UNIQUE per organization", async () => {
    await withRollback(async (tx) => {
      const orgId = `inv6-${Date.now()}`;
      await makeOrg(tx, orgId);

      // Seed a package row for the FK (within the same tx)
      const pkgSlug = `pkg-inv6-${Date.now()}`;
      const pkgRows = await tx`
        INSERT INTO payment_top_up_packages
          (polar_product_id, polar_price_id, slug, name, credits, price_cents, currency)
        VALUES
          (${`prod_inv6_${Date.now()}`}, ${`price_inv6_${Date.now()}`}, ${pkgSlug}, 'INV6 Test', 1000, 1000, 'USD')
        RETURNING id
      `;
      const pkgId = pkgRows[0].id;
      const ikey = `${orgId}:test:1`;
      const now = new Date().toISOString();
      const future = new Date(Date.now() + 30 * 86400_000).toISOString();

      await tx`
        INSERT INTO payment_recharge_history
          (organization_id, period_start, period_end, trigger_reason, package_id, amount_cents, idempotency_key, status, attempted_at)
        VALUES
          (${orgId}, ${now}, ${future}, 'threshold', ${pkgId}, 1000, ${ikey}, 'pending', ${now})
      `;

      // Second insert with same (organization_id, idempotency_key) must fail.
      await expect(
        tx`
          INSERT INTO payment_recharge_history
            (organization_id, period_start, period_end, trigger_reason, package_id, amount_cents, idempotency_key, status, attempted_at)
          VALUES
            (${orgId}, ${now}, ${future}, 'threshold', ${pkgId}, 1000, ${ikey}, 'pending', ${now})
        `,
      ).rejects.toThrow(/unique|idempotency/i);
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // INV-7: payment_extra_usage_settings organization_id UNIQUE
  // ──────────────────────────────────────────────────────────────────
  it("INV-7: extra_usage_settings organization_id UNIQUE", async () => {
    await withRollback(async (tx) => {
      const orgId = `inv7-${Date.now()}`;
      await makeOrg(tx, orgId);

      await tx`
        INSERT INTO payment_extra_usage_settings (organization_id, enabled, monthly_limit_cents)
        VALUES (${orgId}, false, 0)
      `;

      // Second row for same org must violate unique constraint.
      await expect(
        tx`
          INSERT INTO payment_extra_usage_settings (organization_id, enabled, monthly_limit_cents)
          VALUES (${orgId}, true, 5000)
        `,
      ).rejects.toThrow(/unique|organization_id/i);
    });
  });
});
