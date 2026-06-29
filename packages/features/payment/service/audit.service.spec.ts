/**
 * AuditService — DB-backed tests (Phase 7 Task 7.1).
 *
 *   1. log() writes a payment_audit_log row with all fields populated
 *   2. list() filters by actorUserId + paginates via cursor
 */
import { eq } from "drizzle-orm";
import { paymentAuditLog } from "@repo/drizzle";
import {
  cleanupAuditByActor,
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
import { AuditService } from "./audit.service";

const describeIfDb = hasDb ? describe : describe.skip;

jest.setTimeout(30_000);

describeIfDb("AuditService", () => {
  let svc: AuditService;
  let orgId: string;
  let actorId: string;

  beforeAll(() => {
    svc = new AuditService(getDrizzleDb());
  });

  beforeEach(async () => {
    orgId = newOrgId("audit");
    actorId = newUserId("audit-actor");
    await ensureOrg(orgId);
    await ensureUser(actorId);
  });

  afterEach(async () => {
    await cleanupOrg(orgId);
    await cleanupUser(actorId);
  });

  afterAll(async () => {
    await endTestDb();
  });

  it("log() writes a payment_audit_log row with all fields populated", async () => {
    await svc.log({
      actorUserId: actorId,
      action: "test_action",
      targetOrgId: orgId,
      payloadBefore: { foo: "before" },
      payloadAfter: { foo: "after" },
      ipAddress: "10.0.0.1",
      userAgent: "jest/1.0",
      reason: "spec verification",
    });

    const rows = await getDrizzleDb()
      .select()
      .from(paymentAuditLog)
      .where(eq(paymentAuditLog.targetOrgId, orgId));
    expect(rows).toHaveLength(1);
    const r = rows[0]!;
    expect(r.actorUserId).toBe(actorId);
    expect(r.action).toBe("test_action");
    expect(r.payloadBefore).toEqual({ foo: "before" });
    expect(r.payloadAfter).toEqual({ foo: "after" });
    expect(r.ipAddress).toBe("10.0.0.1");
    expect(r.userAgent).toBe("jest/1.0");
    expect(r.reason).toBe("spec verification");
    expect(r.createdAt).toBeInstanceOf(Date);
  });

  it("list() filters by actorUserId and paginates via cursor", async () => {
    // Insert 5 rows for our actor + 1 distractor for a different actor.
    const otherActor = newUserId("audit-other");
    await ensureUser(otherActor);
    try {
      for (let i = 0; i < 5; i++) {
        await svc.log({
          actorUserId: actorId,
          action: `action_${i}`,
          targetOrgId: orgId,
        });
      }
      await svc.log({
        actorUserId: otherActor,
        action: "distractor",
        targetOrgId: orgId,
      });

      // Page 1: limit 3 → newest 3 rows for our actor.
      const page1 = await svc.list({ actorUserId: actorId, limit: 3 });
      expect(page1.rows).toHaveLength(3);
      expect(page1.rows.every((r) => r.actorUserId === actorId)).toBe(true);
      expect(page1.nextCursor).not.toBeNull();
      // Newest first → action_4, action_3, action_2 (any order tolerant of
      // bigserial ties unlikely here, but assert the multiset).
      const actions1 = page1.rows.map((r) => r.action).sort();
      expect(actions1).toEqual(["action_2", "action_3", "action_4"]);

      // Page 2 via cursor: remaining 2 rows.
      const page2 = await svc.list({
        actorUserId: actorId,
        limit: 3,
        cursor: page1.nextCursor!,
      });
      expect(page2.rows).toHaveLength(2);
      expect(page2.nextCursor).toBeNull();
      const actions2 = page2.rows.map((r) => r.action).sort();
      expect(actions2).toEqual(["action_0", "action_1"]);

      // Distractor never appears.
      expect(
        [...page1.rows, ...page2.rows].some((r) => r.action === "distractor"),
      ).toBe(false);
    } finally {
      // payment_audit_log references actor_user_id — drop the rows before
      // dropping the user. cleanupOrg won't reach them because the audit
      // rows for the distractor still reference orgId via target_org_id,
      // but actor_user_id stays even if target_org_id matches.
      await cleanupAuditByActor(otherActor);
      await cleanupUser(otherActor);
    }
  });
});
