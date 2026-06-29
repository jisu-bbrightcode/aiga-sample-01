/**
 * Shared test helpers for community sub-service specs.
 *
 * Bridges the payment test-db utilities (org/user lifecycle) into the
 * community schema: each community lives under a `user.id` (ownerId), and
 * posts/comments/votes/etc. all FK back to communities + users.
 */

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { communities, communityMemberships } from "@repo/drizzle";
import {
  cleanupUser,
  ensureUser,
  getDrizzleDb,
  newUserId,
} from "../../../payment/__tests__/test-db";

export interface CommunityTestCtx {
  ownerId: string;
  communityId: string;
  slug: string;
}

/** Insert a (user + community) pair for a single spec. Returns ctx + teardown. */
export async function setupCommunityCtx(prefix: string): Promise<{
  ctx: CommunityTestCtx;
  teardown: () => Promise<void>;
}> {
  const ownerId = newUserId(`${prefix}-owner`);
  await ensureUser(ownerId);

  const db = getDrizzleDb();
  const slug = `${prefix}-${randomUUID().slice(0, 8)}`;
  const [community] = await db
    .insert(communities)
    .values({
      name: `${prefix}-${randomUUID().slice(0, 6)}`,
      slug,
      description: `${prefix} test community`,
      ownerId,
    })
    .returning({ id: communities.id });

  // Mirror the production `CommunityService.create` side effect: the owner
  // is automatically a member with role=owner. Test helpers that bypass the
  // service still need this row for `assertCommunityPermission` to pass.
  await db
    .insert(communityMemberships)
    .values({ communityId: community!.id, userId: ownerId, role: "owner" })
    .onConflictDoNothing();

  return {
    ctx: { ownerId, communityId: community!.id, slug },
    teardown: async () => {
      await db
        .delete(communityMemberships)
        .where(eq(communityMemberships.communityId, community!.id));
      await db.delete(communities).where(eq(communities.id, community!.id));
      await cleanupUser(ownerId);
    },
  };
}

/** Convenience: create an extra member user inside an existing community. */
export async function addExtraMember(prefix: string, communityId: string): Promise<string> {
  const userId = newUserId(`${prefix}-member`);
  await ensureUser(userId);
  await getDrizzleDb()
    .insert(communityMemberships)
    .values({ communityId, userId, role: "member" })
    .onConflictDoNothing();
  return userId;
}

export async function cleanupExtraMember(userId: string): Promise<void> {
  await getDrizzleDb().delete(communityMemberships).where(eq(communityMemberships.userId, userId));
  await cleanupUser(userId);
}
