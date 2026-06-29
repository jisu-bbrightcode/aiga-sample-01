/**
 * StoryWorldService — DB-backed CRUD + ownership/notfound guards.
 *
 * Mirrors `ProjectService` spec layout:
 *   - real `DATABASE_URL` (skip when absent)
 *   - per-test (owner + org + project) triad via shared helpers
 *   - cleanup deletes the project (cascade) and the auth rows
 */

import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { endTestDb, getDrizzleDb, hasDb, newUserId } from "../../payment/__tests__/test-db";
import {
  cleanupProfile,
  ensureProfile,
  setupStoryCtx,
  type StoryTestCtx,
} from "./__tests__/test-helpers";
import { StoryWorldService } from "./world.service";

const describeIfDb = hasDb ? describe : describe.skip;
jest.setTimeout(30_000);

describeIfDb("StoryWorldService", () => {
  let svc: StoryWorldService;
  let ctx: StoryTestCtx;
  let teardown: () => Promise<void>;

  beforeAll(() => {
    svc = new StoryWorldService(getDrizzleDb());
  });

  beforeEach(async () => {
    const setup = await setupStoryCtx("world");
    ctx = setup.ctx;
    teardown = setup.teardown;
  });

  afterEach(async () => {
    await teardown();
  });

  afterAll(async () => {
    await endTestDb();
  });

  it("createWorld() persists with onConflictDoNothing semantics", async () => {
    const world = await svc.createWorld(ctx.ownerId, {
      projectId: ctx.projectId,
      name: "Aether",
      description: "A sky kingdom",
      genre: "fantasy",
    } as never);
    expect(world?.name).toBe("Aether");
    expect(world?.ownerId).toBe(ctx.ownerId);

    // Same id re-insert is a no-op (returning empty).
    const replay = await svc.createWorld(ctx.ownerId, {
      id: world!.id,
      projectId: ctx.projectId,
      name: "Aether v2",
    } as never);
    expect(replay).toBeUndefined();

    // Original name preserved — second INSERT didn't overwrite.
    const fetched = await svc.getWorld(world!.id, ctx.ownerId);
    expect(fetched.name).toBe("Aether");
  });

  it("listWorlds() filters by project + owner + search + sortBy", async () => {
    await svc.createWorld(ctx.ownerId, {
      projectId: ctx.projectId,
      name: "Alpha",
    } as never);
    await svc.createWorld(ctx.ownerId, {
      projectId: ctx.projectId,
      name: "Beta",
    } as never);

    const all = await svc.listWorlds(ctx.projectId, ctx.ownerId);
    expect(all.map((w) => w.name).sort()).toEqual(["Alpha", "Beta"]);

    const byName = await svc.listWorlds(ctx.projectId, ctx.ownerId, undefined, "name");
    expect(byName.map((w) => w.name)).toEqual(["Alpha", "Beta"]);

    const searched = await svc.listWorlds(ctx.projectId, ctx.ownerId, "alp");
    expect(searched.map((w) => w.name)).toEqual(["Alpha"]);
  });

  it("getWorld() throws NotFoundException for unknown id", async () => {
    await expect(svc.getWorld("00000000-0000-0000-0000-000000000000", ctx.ownerId)).rejects.toThrow(
      NotFoundException,
    );
  });

  it("getWorld() throws ForbiddenException for non-owner", async () => {
    const world = await svc.createWorld(ctx.ownerId, {
      projectId: ctx.projectId,
      name: "X",
    } as never);
    const other = newUserId("world-other");
    await ensureProfile(other);
    try {
      await expect(svc.getWorld(world!.id, other)).rejects.toThrow(ForbiddenException);
    } finally {
      await cleanupProfile(other);
    }
  });

  it("updateWorld() mutates the row", async () => {
    const world = await svc.createWorld(ctx.ownerId, {
      projectId: ctx.projectId,
      name: "X",
    } as never);
    const updated = await svc.updateWorld(world!.id, ctx.ownerId, { name: "Y" } as never);
    expect(updated!.name).toBe("Y");
  });

  it("deleteWorld() soft-deletes the row (list excludes)", async () => {
    const world = await svc.createWorld(ctx.ownerId, {
      projectId: ctx.projectId,
      name: "X",
    } as never);
    await svc.deleteWorld(world!.id, ctx.ownerId);
    const list = await svc.listWorlds(ctx.projectId, ctx.ownerId);
    expect(list).toHaveLength(0);
  });
});
