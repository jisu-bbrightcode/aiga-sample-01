/**
 * CommunityService — happy path covering core CRUD + membership.
 *
 * Focuses on:
 *   - create / findBySlug / findById / findAll
 *   - join / leave / isMember / isModerator
 *   - update / delete (owner-only)
 *   - admin paths
 */

import { ForbiddenException } from "@nestjs/common";
import { communities, communityMemberships, communityModerators } from "@repo/drizzle";
import { eq } from "drizzle-orm";
import {
  cleanupUser,
  endTestDb,
  ensureUser,
  getDrizzleDb,
  hasDb,
  newUserId,
} from "../../payment/__tests__/test-db";
import { CommunityService } from "./community.service";

const describeIfDb = hasDb ? describe : describe.skip;
jest.setTimeout(30_000);

describeIfDb("CommunityService", () => {
  let svc: CommunityService;
  let owner: string;
  let createdCommunityIds: string[] = [];

  beforeAll(() => {
    svc = new CommunityService(getDrizzleDb());
  });

  beforeEach(async () => {
    owner = newUserId("comm-owner");
    await ensureUser(owner);
    createdCommunityIds = [];
  });

  afterEach(async () => {
    const db = getDrizzleDb();
    for (const id of createdCommunityIds) {
      await db.delete(communityMemberships).where(eq(communityMemberships.communityId, id));
      await db.delete(communities).where(eq(communities.id, id));
    }
    await cleanupUser(owner);
  });

  afterAll(async () => {
    await endTestDb();
  });

  async function makeCommunity(name = "test-comm") {
    const c = await svc.create(
      {
        name: `${name}-${Math.random().toString(36).slice(2, 8)}`,
        slug: `${name}-${Math.random().toString(36).slice(2, 8)}`,
        description: "desc",
      } as never,
      owner,
    );
    createdCommunityIds.push(c.id);
    return c;
  }

  it("create() persists with the caller as owner + 1 membership row", async () => {
    const c = await makeCommunity();
    expect(c.ownerId).toBe(owner);

    const memberships = await getDrizzleDb()
      .select()
      .from(communityMemberships)
      .where(eq(communityMemberships.communityId, c.id));
    expect(memberships).toHaveLength(1);
    expect(memberships[0]?.userId).toBe(owner);
  });

  it("findBySlug() + findById() return the row", async () => {
    const c = await makeCommunity();
    await expect(svc.findBySlug(c.slug)).resolves.toMatchObject({ id: c.id });
    await expect(svc.findById(c.id)).resolves.toMatchObject({ id: c.id });
  });

  it("findAll() returns the community in a paginated result", async () => {
    const c = await makeCommunity();
    const list = await svc.findAll({});
    const ids = list.items.map((x) => x.id);
    expect(Array.isArray(ids) ? ids : [ids]).toContainEqual(c.id);
  });

  it("join() + isMember() + leave() round-trip with a non-owner user", async () => {
    const c = await makeCommunity();
    const joiner = newUserId("comm-joiner");
    await ensureUser(joiner);
    try {
      await svc.join(c.slug, joiner);
      await expect(svc.isMember(c.id, joiner)).resolves.toBe(true);
      await svc.leave(c.slug, joiner);
      await expect(svc.isMember(c.id, joiner)).resolves.toBe(false);
    } finally {
      await cleanupUser(joiner);
    }
  });

  it("leave() forbids the owner from leaving", async () => {
    const c = await makeCommunity();
    await expect(svc.leave(c.slug, owner)).rejects.toThrow(ForbiddenException);
  });

  it("update() forbids non-owner from updating", async () => {
    const c = await makeCommunity();
    const intruder = newUserId("comm-intruder");
    await ensureUser(intruder);
    try {
      await expect(
        svc.update(c.slug, { description: "hacked" } as never, intruder),
      ).rejects.toThrow(ForbiddenException);
    } finally {
      await cleanupUser(intruder);
    }
  });

  it("findBySlug() returns null for unknown slug", async () => {
    await expect(svc.findBySlug("no-such-slug-xyz")).resolves.toBeNull();
  });

  // ── PB-COMM-MEMBER-API-001 / BBR-592 ──────────────────────────────────────

  it("getMembers() public view hides banned members and operational fields", async () => {
    const c = await makeCommunity();
    const joiner = newUserId("comm-member");
    const banned = newUserId("comm-banned");
    await ensureUser(joiner);
    await ensureUser(banned);
    try {
      await svc.join(c.slug, joiner);
      await svc.join(c.slug, banned);
      await getDrizzleDb()
        .update(communityMemberships)
        .set({ isBanned: true, bannedReason: "spam" })
        .where(eq(communityMemberships.userId, banned));

      const res = await svc.getMembers(c.slug, undefined, {});
      expect(res.operational).toBe(false);
      const userIds = res.items.map((i) => i.userId);
      expect(userIds).toContain(joiner);
      expect(userIds).not.toContain(banned); // banned excluded from public
      // public items never carry operational fields
      for (const item of res.items as unknown as Record<string, unknown>[]) {
        expect(item).not.toHaveProperty("isBanned");
        expect(item).not.toHaveProperty("bannedReason");
      }
    } finally {
      await cleanupUser(joiner);
      await cleanupUser(banned);
    }
  });

  it("getMembers() operational view exposes ban fields and status=banned filter", async () => {
    const c = await makeCommunity();
    const banned = newUserId("comm-banned2");
    await ensureUser(banned);
    try {
      await svc.join(c.slug, banned);
      await getDrizzleDb()
        .update(communityMemberships)
        .set({ isBanned: true, bannedReason: "abuse" })
        .where(eq(communityMemberships.userId, banned));

      // owner (role=owner) is operational
      const res = await svc.getMembers(c.slug, owner, { status: "banned" });
      expect(res.operational).toBe(true);
      const found = (res.items as unknown as Record<string, unknown>[]).find(
        (i) => i.userId === banned,
      );
      expect(found).toBeDefined();
      expect(found?.isBanned).toBe(true);
      expect(found?.bannedReason).toBe("abuse");
    } finally {
      await cleanupUser(banned);
    }
  });

  it("getMembers() role filter narrows to a single role", async () => {
    const c = await makeCommunity();
    const member = newUserId("comm-role");
    await ensureUser(member);
    try {
      await svc.join(c.slug, member);
      const owners = await svc.getMembers(c.slug, owner, { role: "owner" });
      expect(owners.items.every((i) => i.role === "owner")).toBe(true);
      expect(owners.items.map((i) => i.userId)).toContain(owner);
      expect(owners.items.map((i) => i.userId)).not.toContain(member);
    } finally {
      await cleanupUser(member);
    }
  });

  it("getModerators() separates public identity from operational permissions", async () => {
    const c = await makeCommunity();
    const mod = newUserId("comm-mod");
    await ensureUser(mod);
    try {
      await svc.join(c.slug, mod);
      await getDrizzleDb().insert(communityModerators).values({
        communityId: c.id,
        userId: mod,
        appointedBy: owner,
      });

      const pub = await svc.getModerators(c.slug, undefined);
      expect(pub.operational).toBe(false);
      const pubItem = (pub.items as unknown as Record<string, unknown>[]).find(
        (i) => i.userId === mod,
      );
      expect(pubItem).toBeDefined();
      expect(pubItem).not.toHaveProperty("permissions");
      expect(pubItem).not.toHaveProperty("appointedBy");

      const ops = await svc.getModerators(c.slug, owner);
      expect(ops.operational).toBe(true);
      const opsItem = (ops.items as unknown as Record<string, unknown>[]).find(
        (i) => i.userId === mod,
      );
      expect(opsItem).toHaveProperty("permissions");
      expect(opsItem?.appointedBy).toBe(owner);
    } finally {
      await cleanupUser(mod);
    }
  });
});
