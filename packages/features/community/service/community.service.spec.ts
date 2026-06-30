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
import { communities, communityMemberships, communityModLogs } from "@repo/drizzle";
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

  it("update() by owner writes an audit log row (AC#2)", async () => {
    const c = await makeCommunity();
    const db = getDrizzleDb();

    await svc.update(c.slug, { description: "updated by owner" } as never, owner);

    const logs = await db
      .select()
      .from(communityModLogs)
      .where(eq(communityModLogs.communityId, c.id));
    expect(logs.length).toBe(1);
    expect(logs[0]?.moderatorId).toBe(owner);
    expect(logs[0]?.action).toBe("other");
    expect(logs[0]?.targetType).toBe("community");
    const details = logs[0]?.details as { changes?: Record<string, unknown> };
    expect(details.changes?.description).toEqual({ from: "desc", to: "updated by owner" });

    // cleanup mod logs (FK to community is ON DELETE CASCADE, but be explicit/order-safe)
    await db.delete(communityModLogs).where(eq(communityModLogs.communityId, c.id));
  });

  it("update() no-op (no field changes) does not write an audit log", async () => {
    const c = await makeCommunity();
    const db = getDrizzleDb();

    await svc.update(c.slug, { description: "desc" } as never, owner);

    const logs = await db
      .select()
      .from(communityModLogs)
      .where(eq(communityModLogs.communityId, c.id));
    expect(logs.length).toBe(0);
  });

  it("update() lets a moderator change settings but not name/type (AC#1)", async () => {
    const c = await makeCommunity();
    const db = getDrizzleDb();
    const mod = newUserId("comm-mod");
    await ensureUser(mod);
    await db.insert(communityMemberships).values({
      communityId: c.id,
      userId: mod,
      role: "moderator",
    });
    try {
      // allowed: operational settings
      const updated = await svc.update(c.slug, { description: "mod edit" } as never, mod);
      expect(updated.description).toBe("mod edit");

      // forbidden: identity (name) and visibility (type)
      await expect(svc.update(c.slug, { name: "renamed" } as never, mod)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(svc.update(c.slug, { type: "private" } as never, mod)).rejects.toThrow(
        ForbiddenException,
      );
    } finally {
      await db.delete(communityModLogs).where(eq(communityModLogs.communityId, c.id));
      await cleanupUser(mod);
    }
  });

  it("findBySlug() returns null for unknown slug", async () => {
    await expect(svc.findBySlug("no-such-slug-xyz")).resolves.toBeNull();
  });
});
