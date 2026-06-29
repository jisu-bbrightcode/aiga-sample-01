import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { endTestDb, getDrizzleDb, hasDb, newUserId } from "../../payment/__tests__/test-db";
import {
  cleanupProfile,
  ensureProfile,
  setupStoryCtx,
  type StoryTestCtx,
} from "./__tests__/test-helpers";
import { StoryFactionService } from "./faction.service";

const describeIfDb = hasDb ? describe : describe.skip;
jest.setTimeout(30_000);

describeIfDb("StoryFactionService", () => {
  let svc: StoryFactionService;
  let ctx: StoryTestCtx;
  let teardown: () => Promise<void>;

  beforeAll(() => {
    svc = new StoryFactionService(getDrizzleDb());
  });

  beforeEach(async () => {
    const setup = await setupStoryCtx("fac");
    ctx = setup.ctx;
    teardown = setup.teardown;
  });

  afterEach(async () => {
    await teardown();
  });

  afterAll(async () => {
    await endTestDb();
  });

  it("createFaction() persists goal + influence", async () => {
    const f = await svc.createFaction(ctx.ownerId, {
      projectId: ctx.projectId,
      name: "Iron Pact",
      goal: "Control trade",
      influence: "Regional",
    } as never);
    expect(f?.name).toBe("Iron Pact");
    expect(f?.goal).toBe("Control trade");
    expect(f?.influence).toBe("Regional");
  });

  it("listFactions() supports search + sort", async () => {
    await svc.createFaction(ctx.ownerId, { projectId: ctx.projectId, name: "Alpha" } as never);
    await svc.createFaction(ctx.ownerId, { projectId: ctx.projectId, name: "Beta" } as never);
    expect(
      (await svc.listFactions(ctx.projectId, ctx.ownerId, undefined, "name")).map((f) => f.name),
    ).toEqual(["Alpha", "Beta"]);
    expect((await svc.listFactions(ctx.projectId, ctx.ownerId, "alp")).map((f) => f.name)).toEqual([
      "Alpha",
    ]);
  });

  it("getFaction() throws NotFound + Forbidden", async () => {
    await expect(
      svc.getFaction("00000000-0000-0000-0000-000000000000", ctx.ownerId),
    ).rejects.toThrow(NotFoundException);
    const f = await svc.createFaction(ctx.ownerId, {
      projectId: ctx.projectId,
      name: "X",
    } as never);
    const other = newUserId("fac-other");
    await ensureProfile(other);
    try {
      await expect(svc.getFaction(f!.id, other)).rejects.toThrow(ForbiddenException);
    } finally {
      await cleanupProfile(other);
    }
  });

  it("update + delete cycle", async () => {
    const f = await svc.createFaction(ctx.ownerId, {
      projectId: ctx.projectId,
      name: "X",
    } as never);
    const updated = await svc.updateFaction(f!.id, ctx.ownerId, { influence: "Global" } as never);
    expect(updated!.influence).toBe("Global");
    await svc.deleteFaction(f!.id, ctx.ownerId);
    expect(await svc.listFactions(ctx.projectId, ctx.ownerId)).toHaveLength(0);
  });
});
