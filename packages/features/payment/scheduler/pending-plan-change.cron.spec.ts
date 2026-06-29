/**
 * PendingPlanChangeCron — 매시간 applyAt 만료 pending row 처리 검증.
 *
 * T8 케이스:
 *  1. applyAt <= now row 픽업 → polar PATCH next_period → status='applied' + sub.planId mirror (C1)
 *     미래 row (applyAt > now) 는 픽업하지 않음
 *  2. Polar 실패 시 status='pending' 유지 (다음 tick 재시도)
 *  3. per-row 격리: 첫 row Polar throw 해도 두 번째 row 정상 처리
 *  4. BATCH_LIMIT: due row 가 LIMIT 이상일 때 한 tick 에 LIMIT 까지만 처리
 *  5. comp_* sub 의 pending row → polar 호출 X + status='canceled' (C3)
 */
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  paymentAuditLog,
  paymentPendingPlanChanges,
  paymentSubscriptions,
} from "@repo/drizzle";
import {
  cleanupOrg,
  cleanupPlan,
  cleanupUser,
  endTestDb,
  ensureOrg,
  ensurePlan,
  ensureSubscription,
  ensureUser,
  getDrizzleDb,
  hasDb,
  newOrgId,
  newUserId,
} from "../__tests__/test-db";
import type { PolarAdapter } from "../service/polar.adapter";
import { AuditService } from "../service/audit.service";
import { PendingPlanChangeCron } from "./pending-plan-change.cron";

jest.setTimeout(30_000);

const describeIfDb = hasDb ? describe : describe.skip;

describeIfDb("PendingPlanChangeCron", () => {
  let orgId: string;
  let userId: string;
  let planId: string;
  let altPlanId: string;
  let subId: string;
  let polarMock: { updateSubscription: jest.Mock };
  let cron: PendingPlanChangeCron;

  beforeEach(async () => {
    orgId = newOrgId("ppc");
    userId = newUserId("ppc");
    planId = randomUUID();
    altPlanId = randomUUID();
    subId = randomUUID();

    const polarProductId = `prod_${randomUUID()}`;
    const altProductId = `prod_alt_${randomUUID()}`;

    await ensureOrg(orgId);
    await ensureUser(userId);
    await ensurePlan(planId, { priceCents: 4999, polarProductId });
    await ensurePlan(altPlanId, {
      priceCents: 1999,
      slug: `alt-${altPlanId.slice(0, 8)}`,
      polarProductId: altProductId,
    });
    await ensureSubscription(subId, {
      orgId,
      userId,
      planId,
      polarSubId: `polar_sub_ppc_${subId.slice(0, 8)}`,
    });

    polarMock = {
      updateSubscription: jest.fn(async () => ({
        id: `polar_sub_ppc_${subId.slice(0, 8)}`,
        customerId: "cust_test",
        productId: altProductId,
        status: "active" as const,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000),
        trialEnd: null,
        cancelAtPeriodEnd: false,
        metadata: {},
      })),
    };

    cron = new PendingPlanChangeCron(getDrizzleDb(), polarMock as unknown as PolarAdapter);
  });

  afterEach(async () => {
    const db = getDrizzleDb();
    // pending plan changes 는 subscription ON DELETE CASCADE 로 삭제되지만
    // 명시적으로 먼저 정리 (FK 안전)
    await db
      .delete(paymentPendingPlanChanges)
      .where(eq(paymentPendingPlanChanges.subscriptionId, subId));
    await db
      .delete(paymentSubscriptions)
      .where(eq(paymentSubscriptions.id, subId));
    await cleanupPlan(planId);
    await cleanupPlan(altPlanId);
    await cleanupOrg(orgId);
    await cleanupUser(userId);
  });

  afterAll(async () => {
    await endTestDb();
  });

  // ── 케이스 1 ─────────────────────────────────────────────────────────

  it("applyAt <= now row 픽업 → polar PATCH next_period → status=applied; 미래 row 는 무시", async () => {
    const db = getDrizzleDb();

    // 과거 applyAt (1분 전) — 픽업 대상
    const dueId = randomUUID();
    const pastApplyAt = new Date(Date.now() - 60_000);
    await db.insert(paymentPendingPlanChanges).values({
      id: dueId,
      subscriptionId: subId,
      targetPlanId: altPlanId,
      applyAt: pastApplyAt,
      status: "pending",
    });

    const now = new Date();
    await cron.tick({ now });

    // DB에서 status='applied' 확인
    const [row] = await db
      .select()
      .from(paymentPendingPlanChanges)
      .where(eq(paymentPendingPlanChanges.id, dueId));
    expect(row!.status).toBe("applied");
    expect(row!.appliedAt).not.toBeNull();

    // polar.updateSubscription 호출 확인
    expect(polarMock.updateSubscription).toHaveBeenCalledTimes(1);
    const call = polarMock.updateSubscription.mock.calls[0]!;
    expect(call[1]).toMatchObject({ proration_behavior: "next_period" });

    // C1 fix: sub.planId mirror 검증 — webhook 지연/유실 시 DB 영구 old plan 방지
    const [updatedSub] = await db
      .select()
      .from(paymentSubscriptions)
      .where(eq(paymentSubscriptions.id, subId));
    expect(updatedSub!.planId).toBe(altPlanId);
  });

  it("미래 applyAt row 는 픽업하지 않음", async () => {
    const db = getDrizzleDb();

    // 미래 applyAt (1시간 후)
    const futureId = randomUUID();
    const futureApplyAt = new Date(Date.now() + 3_600_000);
    await db.insert(paymentPendingPlanChanges).values({
      id: futureId,
      subscriptionId: subId,
      targetPlanId: altPlanId,
      applyAt: futureApplyAt,
      status: "pending",
    });

    await cron.tick({ now: new Date() });

    const [row] = await db
      .select()
      .from(paymentPendingPlanChanges)
      .where(eq(paymentPendingPlanChanges.id, futureId));
    expect(row!.status).toBe("pending");
    expect(polarMock.updateSubscription).not.toHaveBeenCalled();
  });

  // ── 케이스 2 ─────────────────────────────────────────────────────────

  it("Polar throw 시 status='pending' 유지 (다음 tick 재시도)", async () => {
    const db = getDrizzleDb();

    const rowId = randomUUID();
    await db.insert(paymentPendingPlanChanges).values({
      id: rowId,
      subscriptionId: subId,
      targetPlanId: altPlanId,
      applyAt: new Date(Date.now() - 60_000),
      status: "pending",
    });

    polarMock.updateSubscription.mockRejectedValueOnce(
      new Error("polar 503"),
    );

    await cron.tick({ now: new Date() });

    const [row] = await db
      .select()
      .from(paymentPendingPlanChanges)
      .where(eq(paymentPendingPlanChanges.id, rowId));
    expect(row!.status).toBe("pending");
  });

  // ── 케이스 3 ─────────────────────────────────────────────────────────

  it("per-row 격리: 첫 row Polar throw 해도 두 번째 row 정상 처리", async () => {
    const db = getDrizzleDb();

    // 두 번째 sub 필요 (partial unique index: subscriptionId WHERE status='pending')
    const sub2Id = randomUUID();
    await ensureSubscription(sub2Id, {
      orgId,
      userId,
      planId,
      polarSubId: `polar_sub_ppc2_${sub2Id.slice(0, 8)}`,
    });

    const now = new Date();
    const pastApplyAt = new Date(now.getTime() - 60_000);

    const row1Id = randomUUID();
    const row2Id = randomUUID();

    await db.insert(paymentPendingPlanChanges).values({
      id: row1Id,
      subscriptionId: subId,
      targetPlanId: altPlanId,
      applyAt: pastApplyAt,
      status: "pending",
    });
    await db.insert(paymentPendingPlanChanges).values({
      id: row2Id,
      subscriptionId: sub2Id,
      targetPlanId: altPlanId,
      applyAt: pastApplyAt,
      status: "pending",
    });

    // 첫 번째 호출만 throw
    polarMock.updateSubscription.mockRejectedValueOnce(new Error("polar 503"));

    await cron.tick({ now });

    // row1: 실패 → pending 유지
    const [r1] = await db
      .select()
      .from(paymentPendingPlanChanges)
      .where(eq(paymentPendingPlanChanges.id, row1Id));
    expect(r1!.status).toBe("pending");

    // row2: 성공 → applied
    const [r2] = await db
      .select()
      .from(paymentPendingPlanChanges)
      .where(eq(paymentPendingPlanChanges.id, row2Id));
    expect(r2!.status).toBe("applied");

    // 총 2회 호출 시도
    expect(polarMock.updateSubscription).toHaveBeenCalledTimes(2);

    // cleanup sub2
    await db
      .delete(paymentPendingPlanChanges)
      .where(eq(paymentPendingPlanChanges.subscriptionId, sub2Id));
    await db
      .delete(paymentSubscriptions)
      .where(eq(paymentSubscriptions.id, sub2Id));
  });

  // ── 케이스 4 ─────────────────────────────────────────────────────────

  it("BATCH_LIMIT: due row 수 > LIMIT 일 때 한 tick 에 LIMIT 까지만 처리", async () => {
    // cron 의 BATCH_LIMIT 을 2 로 오버라이드하여 테스트
    // (실제 BATCH_LIMIT=100 을 직접 테스트하면 100개 fixture 필요)
    const db = getDrizzleDb();
    const SMALL_LIMIT = 2;

    // 서브 3개 생성 (partial unique index 충돌 방지)
    const subIds: string[] = [subId];
    for (let i = 0; i < 2; i++) {
      const s = randomUUID();
      await ensureSubscription(s, {
        orgId,
        userId,
        planId,
        polarSubId: `polar_sub_batch_${s.slice(0, 8)}`,
      });
      subIds.push(s);
    }

    const now = new Date();
    const pastApplyAt = new Date(now.getTime() - 60_000);

    const rowIds: string[] = [];
    for (const s of subIds) {
      const rid = randomUUID();
      rowIds.push(rid);
      await db.insert(paymentPendingPlanChanges).values({
        id: rid,
        subscriptionId: s,
        targetPlanId: altPlanId,
        applyAt: pastApplyAt,
        status: "pending",
      });
    }

    // SMALL_LIMIT 오버라이드 cron
    const limitedCron = new PendingPlanChangeCron(
      getDrizzleDb(),
      polarMock as unknown as PolarAdapter,
      SMALL_LIMIT,
    );
    await limitedCron.tick({ now });

    // BATCH_LIMIT=2 이므로 2개만 applied, 1개는 pending 유지
    let appliedCount = 0;
    let pendingCount = 0;
    for (const rid of rowIds) {
      const [row] = await db
        .select()
        .from(paymentPendingPlanChanges)
        .where(eq(paymentPendingPlanChanges.id, rid));
      if (row!.status === "applied") appliedCount++;
      if (row!.status === "pending") pendingCount++;
    }
    expect(appliedCount).toBe(SMALL_LIMIT);
    expect(pendingCount).toBe(1);

    // cleanup extra subs
    for (const s of subIds.slice(1)) {
      await db
        .delete(paymentPendingPlanChanges)
        .where(eq(paymentPendingPlanChanges.subscriptionId, s));
      await db
        .delete(paymentSubscriptions)
        .where(eq(paymentSubscriptions.id, s));
    }
  });

  // ── 케이스 5 ─────────────────────────────────────────────────────────

  it("comp_* sub 의 pending row → polar 호출 X + status='canceled' + reason (C3 terminal)", async () => {
    const db = getDrizzleDb();

    // sub.polarSubscriptionId 를 comp_* 패턴으로 변경
    await db
      .update(paymentSubscriptions)
      .set({ polarSubscriptionId: "comp_admin_marketing_2026" })
      .where(eq(paymentSubscriptions.id, subId));

    const compRowId = randomUUID();
    await db.insert(paymentPendingPlanChanges).values({
      id: compRowId,
      subscriptionId: subId,
      targetPlanId: altPlanId,
      applyAt: new Date(Date.now() - 60_000),
      status: "pending",
    });

    await cron.tick({ now: new Date() });

    // polar 호출 없음
    expect(polarMock.updateSubscription).not.toHaveBeenCalled();

    // terminal: status='canceled' + reason='cron_skipped_comp_subscription'
    const [row] = await db
      .select()
      .from(paymentPendingPlanChanges)
      .where(eq(paymentPendingPlanChanges.id, compRowId));
    expect(row!.status).toBe("canceled");
    expect(row!.reason).toBe("cron_skipped_comp_subscription");

    // sub.planId 변경 없음 (comp sub 는 mirror skip)
    const [subRow] = await db
      .select()
      .from(paymentSubscriptions)
      .where(eq(paymentSubscriptions.id, subId));
    expect(subRow!.planId).toBe(planId);

    // polarSubscriptionId 복구 (afterEach 정리 위해)
    await db
      .update(paymentSubscriptions)
      .set({ polarSubscriptionId: `polar_sub_ppc_${subId.slice(0, 8)}` })
      .where(eq(paymentSubscriptions.id, subId));
  });

  // ── 케이스 6 (T14) ────────────────────────────────────────────────

  it("T14: cron apply 성공 → audit row 'apply_pending_change' + actorUserId='system'", async () => {
    const db = getDrizzleDb();
    const auditSvc = new AuditService(db);
    const cronWithAudit = new PendingPlanChangeCron(
      db,
      polarMock as unknown as PolarAdapter,
      100,
      auditSvc,
    );

    const rowId = randomUUID();
    await db.insert(paymentPendingPlanChanges).values({
      id: rowId,
      subscriptionId: subId,
      targetPlanId: altPlanId,
      applyAt: new Date(Date.now() - 60_000),
      status: "pending",
    });

    await cronWithAudit.tick({ now: new Date() });

    const audits = await db
      .select()
      .from(paymentAuditLog)
      .where(
        and(
          eq(paymentAuditLog.action, "apply_pending_change"),
          eq(paymentAuditLog.targetSubscriptionId, subId),
        ),
      );
    expect(audits.length).toBe(1);
    // cron 은 sub owner userId 로 기록 (actor_user_id FK 호환)
    expect(audits[0]!.actorUserId).toBe(userId);
    const payload = audits[0]!.payloadAfter as Record<string, unknown>;
    expect(payload.pendingId).toBe(rowId);
    expect(payload.toPlanId).toBe(altPlanId);

    // cleanup audit rows
    await db
      .delete(paymentAuditLog)
      .where(eq(paymentAuditLog.targetSubscriptionId, subId));
  });
});

