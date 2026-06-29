/**
 * Shared test helpers for story sub-service specs.
 *
 * Each lore/draft spec needs the same setup:
 *   - profile row (FK target for `*.owner_id`)
 *   - org row (FK target for `project_projects.organization_id`)
 *   - project row (FK target for `story_*.project_id`)
 *   - per-test cleanup of all the above
 *
 * Keeping the boilerplate here lets the actual specs focus on the service
 * methods.
 */

import { eq } from "drizzle-orm";
import { profiles, projectProjects } from "@repo/drizzle";
import {
  cleanupOrg,
  cleanupUser,
  ensureOrg,
  ensureUser,
  getDrizzleDb,
  newOrgId,
  newUserId,
} from "../../../payment/__tests__/test-db";

export async function ensureProfile(userId: string): Promise<void> {
  const db = getDrizzleDb();
  await db
    .insert(profiles)
    .values({
      id: userId,
      name: `profile-${userId}`,
      email: `${userId}@test.local`,
    })
    .onConflictDoNothing();
}

export async function cleanupProfile(userId: string): Promise<void> {
  await getDrizzleDb().delete(profiles).where(eq(profiles.id, userId));
}

export interface StoryTestCtx {
  ownerId: string;
  orgId: string;
  projectId: string;
}

/**
 * Set up a (profile + org + project) triad for a single spec run.
 * Returns a ctx + a teardown function the test calls in afterEach.
 */
export async function setupStoryCtx(prefix: string): Promise<{
  ctx: StoryTestCtx;
  teardown: () => Promise<void>;
}> {
  const ownerId = newUserId(`${prefix}-owner`);
  const orgId = newOrgId(prefix);
  await ensureOrg(orgId);
  await ensureUser(ownerId);
  await ensureProfile(ownerId);

  const db = getDrizzleDb();
  const [project] = await db
    .insert(projectProjects)
    .values({
      name: `${prefix}-project`,
      ownerId,
      organizationId: orgId,
      lastOpenedAt: new Date(),
    })
    .returning({ id: projectProjects.id });

  const ctx: StoryTestCtx = {
    ownerId,
    orgId,
    projectId: project!.id,
  };

  return {
    ctx,
    teardown: async () => {
      // Delete the project (cascades to story_* tables via FK).
      await db.delete(projectProjects).where(eq(projectProjects.id, ctx.projectId));
      await cleanupProfile(ownerId);
      await cleanupOrg(orgId);
      await cleanupUser(ownerId);
    },
  };
}
