import { makeMockDb } from "./__tests__/mock-db";
import { AdminAuditService } from "./admin-audit.service";
import { AdminRoleService } from "./admin-role.service";

// biome-ignore lint/suspicious/noExplicitAny: test helper.
function build(selectResults: any[][]) {
  const db = makeMockDb(selectResults);
  // biome-ignore lint/suspicious/noExplicitAny: inject test double.
  const audit = new AdminAuditService(db as any);
  // biome-ignore lint/suspicious/noExplicitAny: inject test double.
  const svc = new AdminRoleService(db as any, audit);
  return { db, svc };
}

describe("AdminRoleService.changeRole", () => {
  it("promotes a member to admin, updates membership, and writes an audit row", async () => {
    const { db, svc } = build([
      [{ organizationId: "org-1", role: "owner" }], // actor membership
      [{ id: "mem-target", role: "member" }], // target membership
    ]);

    const result = await svc.changeRole({
      actorUserId: "actor-1",
      targetUserId: "target-1",
      role: "admin",
      reason: "promote",
      ipAddress: "10.0.0.1",
      userAgent: "jest",
    });

    expect(result).toEqual({
      targetUserId: "target-1",
      organizationId: "org-1",
      previousRole: "member",
      role: "admin",
    });
    expect(db.updates).toHaveLength(1);
    expect(db.updates[0]!.set).toEqual({ role: "admin" });
    expect(db.inserts).toHaveLength(1);
    expect(db.inserts[0]!.values).toMatchObject({
      actorUserId: "actor-1",
      action: "user.role_changed",
      targetType: "user",
      targetId: "target-1",
      payloadBefore: { role: "member" },
      payloadAfter: { role: "admin" },
      ipAddress: "10.0.0.1",
      userAgent: "jest",
      reason: "promote",
    });
  });

  it("still audits a no-op when role is unchanged (no DB update)", async () => {
    const { db, svc } = build([
      [{ organizationId: "org-1", role: "admin" }],
      [{ id: "mem-target", role: "admin" }],
    ]);

    await svc.changeRole({ actorUserId: "a", targetUserId: "t", role: "admin" });

    expect(db.updates).toHaveLength(0);
    expect(db.inserts).toHaveLength(1);
  });

  it("rejects self role change", async () => {
    const { svc } = build([]);
    await expect(
      svc.changeRole({ actorUserId: "same", targetUserId: "same", role: "admin" }),
    ).rejects.toThrow();
  });

  it("rejects invalid role", async () => {
    const { svc } = build([]);
    await expect(
      // biome-ignore lint/suspicious/noExplicitAny: invalid input on purpose.
      svc.changeRole({ actorUserId: "a", targetUserId: "t", role: "owner" as any }),
    ).rejects.toThrow();
  });

  it("refuses to modify an owner target", async () => {
    const { db, svc } = build([
      [{ organizationId: "org-1", role: "owner" }],
      [{ id: "mem-owner", role: "owner" }],
    ]);
    await expect(
      svc.changeRole({ actorUserId: "a", targetUserId: "owner-user", role: "member" }),
    ).rejects.toThrow();
    expect(db.updates).toHaveLength(0);
    expect(db.inserts).toHaveLength(0);
  });

  it("404s when target is not a member of the actor's org", async () => {
    const { svc } = build([
      [{ organizationId: "org-1", role: "owner" }],
      [], // no target membership
    ]);
    await expect(
      svc.changeRole({ actorUserId: "a", targetUserId: "ghost", role: "admin" }),
    ).rejects.toThrow();
  });

  it("forbids when actor has no organization membership", async () => {
    const { svc } = build([[]]);
    await expect(
      svc.changeRole({ actorUserId: "a", targetUserId: "t", role: "admin" }),
    ).rejects.toThrow();
  });
});
