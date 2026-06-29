import { makeMockDb } from "./__tests__/mock-db";
import { AdminAuditService } from "./admin-audit.service";

describe("AdminAuditService", () => {
  it("log() inserts an append-only row with defaults nulled", async () => {
    const db = makeMockDb();
    // biome-ignore lint/suspicious/noExplicitAny: inject test double.
    const svc = new AdminAuditService(db as any);

    await svc.log({
      actorUserId: "actor-1",
      action: "user.role_changed",
      targetType: "user",
      targetId: "target-1",
      payloadBefore: { role: "member" },
      payloadAfter: { role: "admin" },
    });

    expect(db.inserts).toHaveLength(1);
    expect(db.inserts[0]!.values).toMatchObject({
      actorUserId: "actor-1",
      action: "user.role_changed",
      targetType: "user",
      targetId: "target-1",
      payloadBefore: { role: "member" },
      payloadAfter: { role: "admin" },
      ipAddress: null,
      userAgent: null,
      reason: null,
    });
  });

  it("list() maps rows (bigint id + Date) and sets nextCursor when full page", async () => {
    const createdAt = new Date("2026-06-30T00:00:00.000Z");
    const db = makeMockDb([
      [
        {
          id: 2n,
          actorUserId: "actor-1",
          action: "user.role_changed",
          targetType: "user",
          targetId: "t2",
          payloadBefore: null,
          payloadAfter: { role: "admin" },
          ipAddress: null,
          userAgent: null,
          reason: null,
          createdAt,
        },
        {
          id: 1n,
          actorUserId: "actor-1",
          action: "user.role_changed",
          targetType: "user",
          targetId: "t1",
          payloadBefore: null,
          payloadAfter: { role: "member" },
          ipAddress: null,
          userAgent: null,
          reason: null,
          createdAt,
        },
      ],
    ]);
    // biome-ignore lint/suspicious/noExplicitAny: inject test double.
    const svc = new AdminAuditService(db as any);

    const result = await svc.list({ limit: 2 });

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]!.id).toBe("2");
    expect(result.rows[0]!.createdAt).toBe("2026-06-30T00:00:00.000Z");
    expect(result.nextCursor).toBe("1");
  });

  it("list() returns null cursor when page not full", async () => {
    const db = makeMockDb([[]]);
    // biome-ignore lint/suspicious/noExplicitAny: inject test double.
    const svc = new AdminAuditService(db as any);
    const result = await svc.list({ limit: 50 });
    expect(result.rows).toHaveLength(0);
    expect(result.nextCursor).toBeNull();
  });
});
