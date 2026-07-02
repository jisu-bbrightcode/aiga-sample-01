import { INVITATION_TTL_MS } from "../helpers/invite-policy";
import { makeMockDb } from "./__tests__/mock-db";
import { AdminAuditService } from "./admin-audit.service";
import { AdminUserInviteService } from "./admin-user-invite.service";

// biome-ignore lint/suspicious/noExplicitAny: test helper.
function build(selectResults: any[][]) {
  const db = makeMockDb(selectResults);
  // biome-ignore lint/suspicious/noExplicitAny: inject test double.
  const audit = new AdminAuditService(db as any);
  // biome-ignore lint/suspicious/noExplicitAny: inject test double.
  const svc = new AdminUserInviteService(db as any, audit);
  return { db, svc };
}

describe("AdminUserInviteService.invite", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");

  it("creates a pending invitation and writes an audit row (AC: 감사 로그)", async () => {
    const { db, svc } = build([
      [{ organizationId: "org-1" }], // actor membership
      [], // no existing user with this email
      [], // no live pending invitation
    ]);

    const result = await svc.invite({
      actorUserId: "actor-1",
      email: "  NewOp@Example.com ",
      role: "admin",
      reason: "ops onboarding",
      ipAddress: "10.0.0.1",
      userAgent: "jest",
      now,
    });

    expect(result).toMatchObject({
      email: "newop@example.com",
      role: "admin",
      status: "pending",
      expiresAt: new Date(now.getTime() + INVITATION_TTL_MS).toISOString(),
    });

    // invitation row + audit row.
    expect(db.inserts).toHaveLength(2);
    expect(db.inserts[0]!.values).toMatchObject({
      organizationId: "org-1",
      email: "newop@example.com",
      role: "admin",
      status: "pending",
      inviterId: "actor-1",
    });
    expect(db.inserts[1]!.values).toMatchObject({
      actorUserId: "actor-1",
      action: "user.invited",
      targetType: "user_invitation",
      payloadAfter: {
        email: "newop@example.com",
        role: "admin",
        organizationId: "org-1",
        status: "pending",
      },
      reason: "ops onboarding",
    });
  });

  it("rejects an invalid role before any DB access (AC: 잘못된 role 차단)", async () => {
    const { db, svc } = build([]);
    await expect(
      svc.invite({ actorUserId: "actor-1", email: "a@example.com", role: "owner" }),
    ).rejects.toThrow("허용되지 않은 역할입니다.");
    expect(db.inserts).toHaveLength(0);
  });

  it("rejects a malformed email", async () => {
    const { svc } = build([]);
    await expect(
      svc.invite({ actorUserId: "actor-1", email: "not-an-email", role: "member" }),
    ).rejects.toThrow("올바른 이메일 주소가 아닙니다.");
  });

  it("blocks an email that already has an account (AC: 중복 이메일 차단)", async () => {
    const { db, svc } = build([
      [{ organizationId: "org-1" }],
      [{ id: "existing-user" }], // duplicate account
    ]);
    await expect(
      svc.invite({ actorUserId: "actor-1", email: "dup@example.com", role: "member" }),
    ).rejects.toThrow("이미 가입된 이메일입니다.");
    expect(db.inserts).toHaveLength(0);
  });

  it("blocks an email with a live pending invitation (AC: 중복 초대 차단)", async () => {
    const { db, svc } = build([
      [{ organizationId: "org-1" }],
      [], // no account
      [{ id: "inv-existing" }], // live pending invite
    ]);
    await expect(
      svc.invite({ actorUserId: "actor-1", email: "dup@example.com", role: "member" }),
    ).rejects.toThrow("이미 초대된 이메일입니다.");
    expect(db.inserts).toHaveLength(0);
  });

  it("fails when the actor has no organization membership", async () => {
    const { svc } = build([[]]);
    await expect(
      svc.invite({ actorUserId: "actor-1", email: "a@example.com", role: "admin" }),
    ).rejects.toThrow("관리자 조직 멤버십을 찾을 수 없습니다.");
  });
});

describe("AdminUserInviteService.resend", () => {
  const now = new Date("2026-02-01T00:00:00.000Z");

  it("extends expiry and audits a pending invitation resend", async () => {
    const { db, svc } = build([
      [{ organizationId: "org-1" }],
      [{ id: "inv-1", email: "op@example.com", role: "member", status: "pending" }],
    ]);

    const result = await svc.resend({ actorUserId: "actor-1", invitationId: "inv-1", now });

    expect(result).toMatchObject({
      id: "inv-1",
      email: "op@example.com",
      status: "pending",
      expiresAt: new Date(now.getTime() + INVITATION_TTL_MS).toISOString(),
    });
    expect(db.updates).toHaveLength(1);
    expect(db.inserts).toHaveLength(1);
    expect(db.inserts[0]!.values).toMatchObject({
      action: "user.invitation_resent",
      targetType: "user_invitation",
      targetId: "inv-1",
    });
  });

  it("404s an unknown invitation", async () => {
    const { svc } = build([[{ organizationId: "org-1" }], []]);
    await expect(svc.resend({ actorUserId: "actor-1", invitationId: "missing" })).rejects.toThrow(
      "초대를 찾을 수 없습니다.",
    );
  });

  it("409s a non-pending invitation", async () => {
    const { svc } = build([
      [{ organizationId: "org-1" }],
      [{ id: "inv-1", email: "op@example.com", role: "member", status: "accepted" }],
    ]);
    await expect(svc.resend({ actorUserId: "actor-1", invitationId: "inv-1" })).rejects.toThrow(
      "대기 중인 초대만 다시 보낼 수 있습니다.",
    );
  });
});

describe("AdminUserInviteService.listInvitations", () => {
  it("maps invitation rows for the actor's organization", async () => {
    const expires = new Date("2026-01-08T00:00:00.000Z");
    const created = new Date("2026-01-01T00:00:00.000Z");
    const { svc } = build([
      [{ organizationId: "org-1" }],
      [
        {
          id: "inv-1",
          email: "op@example.com",
          role: "admin",
          status: "pending",
          expiresAt: expires,
          createdAt: created,
        },
      ],
    ]);

    const result = await svc.listInvitations({ actorUserId: "actor-1", status: "pending" });
    expect(result).toEqual([
      {
        id: "inv-1",
        email: "op@example.com",
        role: "admin",
        status: "pending",
        expiresAt: expires.toISOString(),
        createdAt: created.toISOString(),
      },
    ]);
  });
});
