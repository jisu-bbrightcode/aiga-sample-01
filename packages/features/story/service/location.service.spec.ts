import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { endTestDb, getDrizzleDb, hasDb, newUserId } from "../../payment/__tests__/test-db";
import {
  cleanupProfile,
  ensureProfile,
  setupStoryCtx,
  type StoryTestCtx,
} from "./__tests__/test-helpers";
import { StoryLocationService } from "./location.service";

const describeIfDb = hasDb ? describe : describe.skip;
jest.setTimeout(30_000);

describeIfDb("StoryLocationService", () => {
  let svc: StoryLocationService;
  let ctx: StoryTestCtx;
  let teardown: () => Promise<void>;

  beforeAll(() => {
    svc = new StoryLocationService(getDrizzleDb());
  });

  beforeEach(async () => {
    const setup = await setupStoryCtx("loc");
    ctx = setup.ctx;
    teardown = setup.teardown;
  });

  afterEach(async () => {
    await teardown();
  });

  afterAll(async () => {
    await endTestDb();
  });

  it("createLocation() persists region + climate", async () => {
    const l = await svc.createLocation(ctx.ownerId, {
      projectId: ctx.projectId,
      name: "North Peak",
      region: "North",
      climate: "Cold",
    } as never);
    expect(l?.name).toBe("North Peak");
    expect(l?.region).toBe("North");
    expect(l?.climate).toBe("Cold");
  });

  it("listLocations() supports search + sort", async () => {
    await svc.createLocation(ctx.ownerId, { projectId: ctx.projectId, name: "Alpha" } as never);
    await svc.createLocation(ctx.ownerId, { projectId: ctx.projectId, name: "Beta" } as never);
    const byName = await svc.listLocations(ctx.projectId, ctx.ownerId, undefined, "name");
    expect(byName.map((l) => l.name)).toEqual(["Alpha", "Beta"]);
    expect((await svc.listLocations(ctx.projectId, ctx.ownerId, "alp")).map((l) => l.name)).toEqual(
      ["Alpha"],
    );
  });

  it("getLocation() throws NotFound + Forbidden", async () => {
    await expect(
      svc.getLocation("00000000-0000-0000-0000-000000000000", ctx.ownerId),
    ).rejects.toThrow(NotFoundException);
    const l = await svc.createLocation(ctx.ownerId, {
      projectId: ctx.projectId,
      name: "X",
    } as never);
    const other = newUserId("loc-other");
    await ensureProfile(other);
    try {
      await expect(svc.getLocation(l!.id, other)).rejects.toThrow(ForbiddenException);
    } finally {
      await cleanupProfile(other);
    }
  });

  it("update + delete cycle", async () => {
    const l = await svc.createLocation(ctx.ownerId, {
      projectId: ctx.projectId,
      name: "X",
    } as never);
    const updated = await svc.updateLocation(l!.id, ctx.ownerId, { climate: "Warm" } as never);
    expect(updated!.climate).toBe("Warm");
    await svc.deleteLocation(l!.id, ctx.ownerId);
    expect(await svc.listLocations(ctx.projectId, ctx.ownerId)).toHaveLength(0);
  });
});
