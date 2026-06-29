/**
 * CreditLedgerService — service-level invariants & concurrency.
 *
 * Tests run against the real Neon database (DATABASE_URL). Each test uses
 * a fresh organization id (UUID) so rows from different tests cannot
 * collide; afterEach cleans up the org and its ledger rows.
 *
 *  T1  balance 0 when no entries
 *  T2  grant 1000 → balance 1000
 *  T3  grant 1000 + spend 200 → balance 800
 *  T4  spend rejected when insufficient
 *  T5  grant idempotent on same (subscriptionId, periodKey)
 *  T6  INV-5: refund FIFO — grant 1000, spend 200 → refund reverses 800
 *  T7  admin revoke blocks if balance would go negative
 *  T8  100 concurrent spend serializes via FOR UPDATE + advisory lock
 */
import {
  cleanupOrg,
  endTestDb,
  ensureOrg,
  getDrizzleDb,
  hasDb,
  newOrgId,
} from "../__tests__/test-db";
import { CreditLedgerService } from "./credit-ledger.service";

const describeIfDb = hasDb ? describe : describe.skip;

describeIfDb("CreditLedgerService", () => {
  let svc: CreditLedgerService;
  let orgId: string;

  beforeAll(() => {
    svc = new CreditLedgerService(getDrizzleDb());
  });

  beforeEach(async () => {
    orgId = newOrgId("clds");
    await ensureOrg(orgId);
  });

  afterEach(async () => {
    await cleanupOrg(orgId);
  });

  afterAll(async () => {
    await endTestDb();
  });

  // ── Task 3.1 ───────────────────────────────────────────────────────

  it("balance 0 when no entries", async () => {
    expect(await svc.getBalance(orgId)).toBe(0);
  });

  it("grant 1000 then balance 1000", async () => {
    await svc.grantSubscriptionCycle({
      organizationId: orgId,
      amount: 1000,
      subscriptionId: "sub_x",
      periodKey: "p1",
    });
    expect(await svc.getBalance(orgId)).toBe(1000);
  });

  it("grant 1000 + spend 200 → balance 800", async () => {
    await svc.grantSubscriptionCycle({
      organizationId: orgId,
      amount: 1000,
      subscriptionId: "sub_x",
      periodKey: "p1",
    });
    const out = await svc.spend({
      organizationId: orgId,
      modelKey: "claude-sonnet-4.6",
      inputTokens: 100,
      outputTokens: 200,
      refType: "agent_call",
      refId: "call_1",
      credits: 200,
    });
    expect(out.allowed).toBe(true);
    expect(out.balanceAfter).toBe(800);
    expect(await svc.getBalance(orgId)).toBe(800);
  });

  it("spend rejected when balance insufficient", async () => {
    await svc.grantSubscriptionCycle({
      organizationId: orgId,
      amount: 100,
      subscriptionId: "sub_x",
      periodKey: "p1",
    });
    const out = await svc.spend({
      organizationId: orgId,
      modelKey: "claude-opus-4.7",
      inputTokens: 100,
      outputTokens: 100,
      refType: "agent_call",
      refId: "call_2",
      credits: 200,
    });
    expect(out.allowed).toBe(false);
    expect(out.balanceAfter).toBe(100);
  });

  it("grant idempotent on same periodKey", async () => {
    const k = {
      organizationId: orgId,
      amount: 1000,
      subscriptionId: "sub_x",
      periodKey: "p1",
    };
    await svc.grantSubscriptionCycle(k);
    await svc.grantSubscriptionCycle(k);
    expect(await svc.getBalance(orgId)).toBe(1000);
  });

  // ── Task 3.2 ───────────────────────────────────────────────────────

  it("INV-5: refund FIFO — grant 1000 + spend 200 → refund reverse 800", async () => {
    // Larger timeout: refund opens its own tx after grant + spend in serial.

    await svc.grantSubscriptionCycle({
      organizationId: orgId,
      amount: 1000,
      subscriptionId: "sub_x",
      periodKey: "2026-04",
    });
    await svc.spend({
      organizationId: orgId,
      modelKey: "claude-sonnet-4.6",
      inputTokens: 100,
      outputTokens: 100,
      refType: "agent_call",
      refId: "c1",
      credits: 200,
    });
    const out = await svc.refundReverse({
      organizationId: orgId,
      subscriptionPeriodKey: "sub_x:2026-04",
      refundId: "ref_1",
    });
    expect(out.reverted).toBe(800);
    expect(await svc.getBalance(orgId)).toBe(0);
  }, 30_000);

  it("admin revoke blocks if balance would be negative", async () => {
    await svc.grantSubscriptionCycle({
      organizationId: orgId,
      amount: 100,
      subscriptionId: "sub_x",
      periodKey: "p1",
    });
    await expect(
      svc.revokeAdmin({
        organizationId: orgId,
        amount: 200,
        actorUserId: "admin_u",
        idempotencyKey: "k1",
      }),
    ).rejects.toThrow(/negative/);
  });

  // ── Task 3.3 ───────────────────────────────────────────────────────

  it("100 concurrent spend never goes negative (FOR UPDATE)", async () => {
    await svc.grantSubscriptionCycle({
      organizationId: orgId,
      amount: 1000,
      subscriptionId: "sub_x",
      periodKey: "p1",
    });
    const tasks = Array.from({ length: 100 }, (_, i) =>
      svc.spend({
        organizationId: orgId,
        modelKey: "x",
        inputTokens: 0,
        outputTokens: 0,
        refType: "concurrent",
        refId: `c${i}`,
        credits: 50,
      }),
    );
    const results = await Promise.all(tasks);
    const allowed = results.filter((r) => r.allowed).length;
    expect(allowed).toBe(20); // 1000 / 50
    expect(await svc.getBalance(orgId)).toBe(0);
  }, 180_000);
});
