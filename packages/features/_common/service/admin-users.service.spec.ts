import { makeMockDb } from "./__tests__/mock-db";
import { AdminAuditService } from "./admin-audit.service";
import { AdminUsersService } from "./admin-users.service";
import { SessionRevocationService } from "./session-revocation.service";

// biome-ignore lint/suspicious/noExplicitAny: test helper.
function build(selectResults: any[][], deleteResults: any[][] = []) {
  const db = makeMockDb(selectResults, deleteResults);
  // biome-ignore lint/suspicious/noExplicitAny: inject test double.
  const audit = new AdminAuditService(db as any);
  // biome-ignore lint/suspicious/noExplicitAny: inject test double.
  const sessionRevocation = new SessionRevocationService(db as any);
  // biome-ignore lint/suspicious/noExplicitAny: inject test double.
  const svc = new AdminUsersService(db as any, audit, sessionRevocation);
  return { db, svc };
}

const CREATED = new Date("2026-01-02T03:04:05.000Z");

describe("AdminUsersService.list", () => {
  it("maps users with RBAC roles, org access role, and total", async () => {
    const { svc } = build([
      [{ count: 2 }], // count
      [
        {
          id: "u1",
          userName: "User One",
          userEmail: "u1@a.com",
          userImage: null,
          emailVerified: true,
          createdAt: CREATED,
          profileName: "프로필1",
          profileEmail: "p1@a.com",
          profileAvatar: "https://img/1",
          isActive: true,
        },
        {
          id: "u2",
          userName: "User Two",
          userEmail: "u2@a.com",
          userImage: null,
          emailVerified: false,
          createdAt: CREATED,
          profileName: null,
          profileEmail: null,
          profileAvatar: null,
          isActive: false,
        },
      ],
      [{ userId: "u1", roleSlug: "admin" }], // rbac roles
      [
        { userId: "u1", role: "admin" },
        { userId: "u1", role: "member" }, // multi-membership: owner-priority collapses
        { userId: "u2", role: "member" },
      ],
    ]);

    const result = await svc.list({ limit: 20, offset: 0 });

    expect(result.total).toBe(2);
    expect(result.users).toHaveLength(2);
    // profile values win over the better-auth user row
    expect(result.users[0]).toMatchObject({
      id: "u1",
      name: "프로필1",
      email: "p1@a.com",
      image: "https://img/1",
      roles: ["admin"],
      accessRole: "admin",
      isActive: true,
      emailVerified: true,
    });
    expect(result.users[0]!.createdAt).toBe(CREATED.toISOString());
    // not archived → deletedAt null (distinguishes 정지 from 보관)
    expect(result.users[0]!.deletedAt).toBeNull();
    // falls back to user row + defaults when no profile/roles
    expect(result.users[1]).toMatchObject({
      id: "u2",
      name: "User Two",
      email: "u2@a.com",
      roles: ["user"],
      accessRole: "member",
      isActive: false,
    });
  });

  it("collapses multi-org memberships to the highest-privilege role", async () => {
    const { svc } = build([
      [{ count: 1 }],
      [
        {
          id: "u1",
          userName: "U",
          userEmail: "u@a.com",
          userImage: null,
          emailVerified: true,
          createdAt: CREATED,
          profileName: null,
          profileEmail: null,
          profileAvatar: null,
          isActive: true,
        },
      ],
      [], // no rbac roles
      [
        { userId: "u1", role: "member" },
        { userId: "u1", role: "owner" },
      ],
    ]);

    const result = await svc.list({});
    expect(result.users[0]!.accessRole).toBe("owner");
  });

  it("returns empty without querying roles when no users match", async () => {
    const { svc } = build([
      [{ count: 0 }],
      [], // no rows
    ]);
    const result = await svc.list({ q: "nobody" });
    expect(result).toEqual({ users: [], total: 0 });
  });

  it("applies status/accessRole filters and sort without breaking mapping", async () => {
    const { svc } = build([
      [{ count: 1 }],
      [
        {
          id: "u1",
          userName: "Zoe",
          userEmail: "zoe@a.com",
          userImage: null,
          emailVerified: true,
          createdAt: CREATED,
          profileName: null,
          profileEmail: null,
          profileAvatar: null,
          isActive: false,
        },
      ],
      [], // rbac roles
      [{ userId: "u1", role: "admin" }],
    ]);

    const result = await svc.list({
      status: "inactive",
      accessRole: "admin",
      sort: "name",
      order: "asc",
    });

    expect(result.total).toBe(1);
    expect(result.users[0]).toMatchObject({ id: "u1", accessRole: "admin", isActive: false });
  });
});

describe("AdminUsersService.setActive", () => {
  it("deactivates an account, persists the flag, and writes an audit row", async () => {
    const { db, svc } = build(
      [
        [{ id: "t1", isActive: true }], // target profile
        [], // owner-membership check (not an owner)
      ],
      [[{ id: "sess-1" }, { id: "sess-2" }]], // revoked sessions
    );

    const result = await svc.setActive({
      actorUserId: "actor",
      targetUserId: "t1",
      isActive: false,
      reason: "abuse",
      ipAddress: "10.0.0.2",
      userAgent: "jest",
    });

    expect(result).toEqual({
      targetUserId: "t1",
      previousActive: true,
      isActive: false,
      revokedSessions: 2,
    });
    expect(db.updates).toHaveLength(1);
    expect(db.updates[0]!.set).toEqual({ isActive: false });
    // deactivation revokes the account's live sessions (AC: 세션·권한 일관 정리)
    expect(db.deletes).toHaveLength(1);
    expect(db.inserts).toHaveLength(1);
    expect(db.inserts[0]!.values).toMatchObject({
      actorUserId: "actor",
      action: "user.status_changed",
      targetType: "user",
      targetId: "t1",
      payloadBefore: { isActive: true },
      payloadAfter: { isActive: false, revokedSessions: 2 },
      reason: "abuse",
    });
  });

  it("does not revoke sessions when reactivating (sessions stay cleared)", async () => {
    const { db, svc } = build([
      [{ id: "t1", isActive: false }], // currently inactive
    ]);
    const result = await svc.setActive({ actorUserId: "a", targetUserId: "t1", isActive: true });
    expect(result.isActive).toBe(true);
    expect(result.revokedSessions).toBe(0);
    expect(db.deletes).toHaveLength(0);
    expect(db.updates).toHaveLength(1);
  });

  it("audits a no-op reactivation without a DB update", async () => {
    const { db, svc } = build([
      [{ id: "t1", isActive: true }], // already active
    ]);
    const result = await svc.setActive({ actorUserId: "a", targetUserId: "t1", isActive: true });
    expect(result.previousActive).toBe(true);
    expect(db.updates).toHaveLength(0);
    expect(db.inserts).toHaveLength(1);
  });

  it("rejects deactivating yourself", async () => {
    const { db, svc } = build([]);
    await expect(
      svc.setActive({ actorUserId: "same", targetUserId: "same", isActive: false }),
    ).rejects.toThrow();
    expect(db.updates).toHaveLength(0);
    expect(db.inserts).toHaveLength(0);
  });

  it("404s when the target profile does not exist", async () => {
    const { svc } = build([[]]);
    await expect(
      svc.setActive({ actorUserId: "a", targetUserId: "ghost", isActive: false }),
    ).rejects.toThrow();
  });

  it("refuses to deactivate an owner account", async () => {
    const { db, svc } = build([
      [{ id: "owner1", isActive: true }],
      [{ id: "mem-owner" }], // owner membership present
    ]);
    await expect(
      svc.setActive({ actorUserId: "a", targetUserId: "owner1", isActive: false }),
    ).rejects.toThrow();
    expect(db.updates).toHaveLength(0);
    expect(db.inserts).toHaveLength(0);
  });
});
