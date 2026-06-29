/**
 * UsageReserveCron — reserve expiry + recharge timeout sweep 검증.
 *
 * T3 케이스:
 *  1. expiresAt 과거 reserved row → cron tick 후 status='expired'
 *  2. expiresAt 미래 reserved row → status='reserved' 유지 (변경 없음)
 *  3. attemptedAt 5분 이상 pending recharge → status='timeout', timeoutAt=now
 */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  paymentRechargeHistory,
  paymentTopUpPackages,
  paymentUsageReserves,
} from "@repo/drizzle";
import {
  cleanupOrg,
  cleanupUser,
  endTestDb,
  ensureOrg,
  ensureUser,
  getDrizzleDb,
  hasDb,
  newOrgId,
  newUserId,
} from "../__tests__/test-db";
import { UsageReserveCron } from "./usage-reserve.cron";

jest.setTimeout(30_000);

const describeIfDb = hasDb ? describe : describe.skip;

describeIfDb("UsageReserveCron", () => {
  let cron: UsageReserveCron;
  let orgId: string;
  let userId: string;
  let packageId: string;

  beforeEach(async () => {
    orgId = newOrgId("urc");
    userId = newUserId("urc");
    packageId = randomUUID();

    await ensureOrg(orgId);
    await ensureUser(userId);

    // recharge_history FK 용 top_up_package seed
    await getDrizzleDb().insert(paymentTopUpPackages).values({
      id: packageId,
      polarProductId: `prod_urc_${packageId.slice(0, 8)}`,
      polarPriceId: `price_urc_${packageId.slice(0, 8)}`,
      slug: `pkg-urc-${packageId.slice(0, 8)}`,
      name: "Test Package",
      credits: 1000,
      priceCents: 999,
    });

    cron = new UsageReserveCron(getDrizzleDb());
  });

  afterEach(async () => {
    const db = getDrizzleDb();
    await db
      .delete(paymentRechargeHistory)
      .where(eq(paymentRechargeHistory.organizationId, orgId));
    await db
      .delete(paymentUsageReserves)
      .where(eq(paymentUsageReserves.organizationId, orgId));
    await db
      .delete(paymentTopUpPackages)
      .where(eq(paymentTopUpPackages.id, packageId));
    await cleanupOrg(orgId);
    await cleanupUser(userId);
  });

  afterAll(async () => {
    await endTestDb();
  });

  // ── 케이스 1 ────────────────────────────────────────────────────────

  it("expiresAt 과거 reserved row → cron tick 후 status=expired", async () => {
    const db = getDrizzleDb();
    const reserveId = randomUUID();
    const pastExpiresAt = new Date(Date.now() - 60_000); // 1분 전

    await db.insert(paymentUsageReserves).values({
      id: reserveId,
      organizationId: orgId,
      estimateCents: 50,
      status: "reserved",
      refType: "ai_call",
      refId: `call_urc_1_${reserveId.slice(0, 8)}`,
      expiresAt: pastExpiresAt,
    });

    const now = new Date();
    await cron.tick({ now });

    const [row] = await db
      .select()
      .from(paymentUsageReserves)
      .where(eq(paymentUsageReserves.id, reserveId));
    expect(row!.status).toBe("expired");
  });

  // ── 케이스 2 ────────────────────────────────────────────────────────

  it("expiresAt 미래 reserved row → status=reserved 유지 (변경 없음)", async () => {
    const db = getDrizzleDb();
    const reserveId = randomUUID();
    const futureExpiresAt = new Date(Date.now() + 3_600_000); // 1시간 후

    await db.insert(paymentUsageReserves).values({
      id: reserveId,
      organizationId: orgId,
      estimateCents: 50,
      status: "reserved",
      refType: "ai_call",
      refId: `call_urc_2_${reserveId.slice(0, 8)}`,
      expiresAt: futureExpiresAt,
    });

    await cron.tick({ now: new Date() });

    const [row] = await db
      .select()
      .from(paymentUsageReserves)
      .where(eq(paymentUsageReserves.id, reserveId));
    expect(row!.status).toBe("reserved");
  });

  // ── 케이스 3 ────────────────────────────────────────────────────────

  it("attemptedAt 5분 이상 경과 pending recharge → status=timeout, timeoutAt=now", async () => {
    const db = getDrizzleDb();
    const rechargeId = randomUUID();
    const stuckAttemptedAt = new Date(Date.now() - 6 * 60_000); // 6분 전

    await db.insert(paymentRechargeHistory).values({
      id: rechargeId,
      organizationId: orgId,
      periodStart: new Date("2026-04-01"),
      periodEnd: new Date("2026-05-01"),
      triggerReason: "threshold",
      packageId,
      amountCents: 999,
      idempotencyKey: `idem_urc_${rechargeId.slice(0, 8)}`,
      status: "pending",
      attemptedAt: stuckAttemptedAt,
    });

    const now = new Date();
    await cron.tick({ now });

    const [row] = await db
      .select()
      .from(paymentRechargeHistory)
      .where(eq(paymentRechargeHistory.id, rechargeId));
    expect(row!.status).toBe("timeout");
    expect(row!.timeoutAt).not.toBeNull();
    // timeoutAt ≈ now (1초 이내)
    expect(Math.abs(row!.timeoutAt!.getTime() - now.getTime())).toBeLessThan(1000);
  });
});
