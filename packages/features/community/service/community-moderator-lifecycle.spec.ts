/**
 * CommunityModerationService — moderator invite/permission lifecycle (BBR-593).
 *
 * DB-gated integration coverage for the invite → accept/decline → re-permission
 * → remove flow plus ownership transfer and authorization gates. Each assertion
 * pins a deliverable: durable invite status (AC#2), audit rows (AC#2), and
 * owner/permission-gated mutations (AC#1).
 */

import { ConflictException, ForbiddenException } from "@nestjs/common";
import {
  communities,
  communityMemberships,
  communityModerators,
  communityModLogs,
} from "@repo/drizzle";
import { and, eq } from "drizzle-orm";
import { endTestDb, getDrizzleDb, hasDb } from "../../payment/__tests__/test-db";
import { addExtraMember, cleanupExtraMember, setupCommunityCtx } from "./__tests__/test-helpers";
import { CommunityService } from "./community.service";
import { CommunityModerationService } from "./community-moderation.service";

const describeIfDb = hasDb ? describe : describe.skip;
jest.setTimeout(30_000);

describeIfDb("CommunityModerationService — moderator lifecycle", () => {
  let svc: CommunityModerationService;
  let ctx: Awaited<ReturnType<typeof setupCommunityCtx>>["ctx"];
  let teardown: () => Promise<void>;
  let candidate: string;
  let other: string;

  beforeAll(() => {
    const db = getDrizzleDb();
    svc = new CommunityModerationService(db, new CommunityService(db));
  });

  beforeEach(async () => {
    const setup = await setupCommunityCtx("modlife");
    ctx = setup.ctx;
    teardown = setup.teardown;
    candidate = await addExtraMember("modlife", ctx.communityId);
    other = await addExtraMember("modlife", ctx.communityId);
  });

  afterEach(async () => {
    const db = getDrizzleDb();
    await db
      .delete(communityModerators)
      .where(eq(communityModerators.communityId, ctx.communityId));
    await db.delete(communityModLogs).where(eq(communityModLogs.communityId, ctx.communityId));
    await cleanupExtraMember(candidate);
    await cleanupExtraMember(other);
    await teardown();
  });

  afterAll(async () => {
    await endTestDb();
  });

  const membershipRole = async (userId: string): Promise<string | null> => {
    const [m] = await getDrizzleDb()
      .select({ role: communityMemberships.role })
      .from(communityMemberships)
      .where(
        and(
          eq(communityMemberships.communityId, ctx.communityId),
          eq(communityMemberships.userId, userId),
        ),
      )
      .limit(1);
    return m?.role ?? null;
  };

  const modLogCount = async (): Promise<number> => {
    const rows = await getDrizzleDb()
      .select({ id: communityModLogs.id })
      .from(communityModLogs)
      .where(eq(communityModLogs.communityId, ctx.communityId));
    return rows.length;
  };

  it("invite creates a pending appointment and an audit row without promoting the member", async () => {
    const m = await svc.inviteModerator(
      { communityId: ctx.communityId, userId: candidate, permissions: {} } as never,
      ctx.ownerId,
    );
    expect(m.status).toBe("pending");
    expect(await membershipRole(candidate)).toBe("member");
    expect(await modLogCount()).toBe(1);
  });

  it("accept activates the appointment and promotes the membership to moderator", async () => {
    await svc.inviteModerator(
      { communityId: ctx.communityId, userId: candidate, permissions: {} } as never,
      ctx.ownerId,
    );
    const updated = await svc.respondToModeratorInvite(ctx.communityId, candidate, true);
    expect(updated.status).toBe("active");
    expect(updated.respondedAt).toBeTruthy();
    expect(await membershipRole(candidate)).toBe("moderator");
  });

  it("decline records declined status and leaves the membership untouched", async () => {
    await svc.inviteModerator(
      { communityId: ctx.communityId, userId: candidate, permissions: {} } as never,
      ctx.ownerId,
    );
    const updated = await svc.respondToModeratorInvite(ctx.communityId, candidate, false);
    expect(updated.status).toBe("declined");
    expect(await membershipRole(candidate)).toBe("member");
  });

  it("responding to an already-resolved invite is rejected", async () => {
    await svc.inviteModerator(
      { communityId: ctx.communityId, userId: candidate, permissions: {} } as never,
      ctx.ownerId,
    );
    await svc.respondToModeratorInvite(ctx.communityId, candidate, true);
    await expect(svc.respondToModeratorInvite(ctx.communityId, candidate, true)).rejects.toThrow(
      ConflictException,
    );
  });

  it("inviting an already pending/active moderator is rejected", async () => {
    await svc.inviteModerator(
      { communityId: ctx.communityId, userId: candidate, permissions: {} } as never,
      ctx.ownerId,
    );
    await expect(
      svc.inviteModerator(
        { communityId: ctx.communityId, userId: candidate, permissions: {} } as never,
        ctx.ownerId,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it("re-invites a declined candidate by resetting the appointment to pending", async () => {
    await svc.inviteModerator(
      { communityId: ctx.communityId, userId: candidate, permissions: {} } as never,
      ctx.ownerId,
    );
    await svc.respondToModeratorInvite(ctx.communityId, candidate, false);
    const reinvited = await svc.inviteModerator(
      { communityId: ctx.communityId, userId: candidate, permissions: {} } as never,
      ctx.ownerId,
    );
    expect(reinvited.status).toBe("pending");
    expect(reinvited.respondedAt).toBeNull();
  });

  it("updates permissions on an active appointment", async () => {
    await svc.inviteModerator(
      { communityId: ctx.communityId, userId: candidate, permissions: {} } as never,
      ctx.ownerId,
    );
    await svc.respondToModeratorInvite(ctx.communityId, candidate, true);
    const updated = await svc.updateModeratorPermissions(
      {
        communityId: ctx.communityId,
        userId: candidate,
        permissions: { managePosts: false },
      } as never,
      ctx.ownerId,
    );
    expect(updated.permissions.managePosts).toBe(false);
    expect(updated.permissions.manageComments).toBe(true);
  });

  it("rejects permission changes on a pending (not yet active) appointment", async () => {
    await svc.inviteModerator(
      { communityId: ctx.communityId, userId: candidate, permissions: {} } as never,
      ctx.ownerId,
    );
    await expect(
      svc.updateModeratorPermissions(
        {
          communityId: ctx.communityId,
          userId: candidate,
          permissions: { managePosts: false },
        } as never,
        ctx.ownerId,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it("remove revokes the appointment and demotes the membership", async () => {
    await svc.inviteModerator(
      { communityId: ctx.communityId, userId: candidate, permissions: {} } as never,
      ctx.ownerId,
    );
    await svc.respondToModeratorInvite(ctx.communityId, candidate, true);
    await svc.removeModerator(ctx.communityId, candidate, ctx.ownerId);

    const [row] = await getDrizzleDb()
      .select()
      .from(communityModerators)
      .where(
        and(
          eq(communityModerators.communityId, ctx.communityId),
          eq(communityModerators.userId, candidate),
        ),
      )
      .limit(1);
    expect(row?.status).toBe("revoked");
    expect(row?.revokedAt).toBeTruthy();
    expect(await membershipRole(candidate)).toBe("member");
  });

  it("denies a plain member from inviting moderators (AC#1)", async () => {
    await expect(
      svc.inviteModerator(
        { communityId: ctx.communityId, userId: candidate, permissions: {} } as never,
        other,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it("transfers ownership: new owner promoted, previous owner demoted to admin", async () => {
    const result = await svc.transferOwnership(
      { communityId: ctx.communityId, newOwnerId: candidate } as never,
      ctx.ownerId,
    );
    expect(result.newOwnerId).toBe(candidate);

    const [community] = await getDrizzleDb()
      .select({ ownerId: communities.ownerId })
      .from(communities)
      .where(eq(communities.id, ctx.communityId))
      .limit(1);
    expect(community?.ownerId).toBe(candidate);
    expect(await membershipRole(candidate)).toBe("owner");
    expect(await membershipRole(ctx.ownerId)).toBe("admin");
  });

  it("denies a non-owner from transferring ownership (AC#1)", async () => {
    await expect(
      svc.transferOwnership(
        { communityId: ctx.communityId, newOwnerId: other } as never,
        candidate,
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});
