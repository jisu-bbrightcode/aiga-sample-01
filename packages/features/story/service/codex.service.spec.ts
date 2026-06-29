import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { endTestDb, getDrizzleDb, hasDb, newUserId } from "../../payment/__tests__/test-db";
import {
  cleanupProfile,
  ensureProfile,
  setupStoryCtx,
  type StoryTestCtx,
} from "./__tests__/test-helpers";
import { StoryCodexService } from "./codex.service";

const describeIfDb = hasDb ? describe : describe.skip;
jest.setTimeout(30_000);

describeIfDb("StoryCodexService", () => {
  let svc: StoryCodexService;
  let ctx: StoryTestCtx;
  let teardown: () => Promise<void>;

  beforeAll(() => {
    svc = new StoryCodexService(getDrizzleDb());
  });

  beforeEach(async () => {
    const setup = await setupStoryCtx("codex");
    ctx = setup.ctx;
    teardown = setup.teardown;
  });

  afterEach(async () => {
    await teardown();
  });

  afterAll(async () => {
    await endTestDb();
  });

  it("createCodexEntry() persists category", async () => {
    const e = await svc.createCodexEntry(ctx.ownerId, {
      projectId: ctx.projectId,
      name: "Aether Crystal",
      category: "artifact",
    } as never);
    expect(e?.name).toBe("Aether Crystal");
    expect(e?.category).toBe("artifact");
  });

  it("listCodex() supports search + sort", async () => {
    await svc.createCodexEntry(ctx.ownerId, {
      projectId: ctx.projectId,
      name: "Alpha",
    } as never);
    await svc.createCodexEntry(ctx.ownerId, {
      projectId: ctx.projectId,
      name: "Beta",
    } as never);
    expect(
      (await svc.listCodex(ctx.projectId, ctx.ownerId, undefined, "name")).map((c) => c.name),
    ).toEqual(["Alpha", "Beta"]);
    expect((await svc.listCodex(ctx.projectId, ctx.ownerId, "alp")).map((c) => c.name)).toEqual([
      "Alpha",
    ]);
  });

  it("getCodexEntry() throws NotFound + Forbidden", async () => {
    await expect(
      svc.getCodexEntry("00000000-0000-0000-0000-000000000000", ctx.ownerId),
    ).rejects.toThrow(NotFoundException);
    const e = await svc.createCodexEntry(ctx.ownerId, {
      projectId: ctx.projectId,
      name: "X",
    } as never);
    const other = newUserId("codex-other");
    await ensureProfile(other);
    try {
      await expect(svc.getCodexEntry(e!.id, other)).rejects.toThrow(ForbiddenException);
    } finally {
      await cleanupProfile(other);
    }
  });

  it("update + delete cycle", async () => {
    const e = await svc.createCodexEntry(ctx.ownerId, {
      projectId: ctx.projectId,
      name: "X",
    } as never);
    const updated = await svc.updateCodexEntry(e!.id, ctx.ownerId, { category: "lore" } as never);
    expect(updated!.category).toBe("lore");
    await svc.deleteCodexEntry(e!.id, ctx.ownerId);
    expect(await svc.listCodex(ctx.projectId, ctx.ownerId)).toHaveLength(0);
  });
});
