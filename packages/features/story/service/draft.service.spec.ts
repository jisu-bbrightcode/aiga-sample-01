import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { endTestDb, getDrizzleDb, hasDb, newUserId } from "../../payment/__tests__/test-db";
import {
  cleanupProfile,
  ensureProfile,
  setupStoryCtx,
  type StoryTestCtx,
} from "./__tests__/test-helpers";
import { StoryDraftService } from "./draft.service";

const describeIfDb = hasDb ? describe : describe.skip;
jest.setTimeout(30_000);

describeIfDb("StoryDraftService", () => {
  let svc: StoryDraftService;
  let ctx: StoryTestCtx;
  let teardown: () => Promise<void>;

  beforeAll(() => {
    svc = new StoryDraftService(getDrizzleDb());
  });

  beforeEach(async () => {
    const setup = await setupStoryCtx("draft");
    ctx = setup.ctx;
    teardown = setup.teardown;
  });

  afterEach(async () => {
    await teardown();
  });

  afterAll(async () => {
    await endTestDb();
  });

  it("createDraft() persists title + sortOrder", async () => {
    const d = await svc.createDraft(ctx.ownerId, {
      projectId: ctx.projectId,
      title: "Chapter 1",
      sortOrder: 5,
    } as never);
    expect(d?.title).toBe("Chapter 1");
    expect(d?.sortOrder).toBe(5);
  });

  it("listDrafts() sorts by title for sortBy=name", async () => {
    await svc.createDraft(ctx.ownerId, { projectId: ctx.projectId, title: "Alpha" } as never);
    await svc.createDraft(ctx.ownerId, { projectId: ctx.projectId, title: "Beta" } as never);
    expect(
      (await svc.listDrafts(ctx.projectId, ctx.ownerId, undefined, "name")).map((d) => d.title),
    ).toEqual(["Alpha", "Beta"]);
    expect((await svc.listDrafts(ctx.projectId, ctx.ownerId, "alp")).map((d) => d.title)).toEqual([
      "Alpha",
    ]);
  });

  it("getDraft() throws NotFound + Forbidden", async () => {
    await expect(svc.getDraft("00000000-0000-0000-0000-000000000000", ctx.ownerId)).rejects.toThrow(
      NotFoundException,
    );
    const d = await svc.createDraft(ctx.ownerId, {
      projectId: ctx.projectId,
      title: "X",
    } as never);
    const other = newUserId("draft-other");
    await ensureProfile(other);
    try {
      await expect(svc.getDraft(d!.id, other)).rejects.toThrow(ForbiddenException);
    } finally {
      await cleanupProfile(other);
    }
  });

  it("update + delete cycle", async () => {
    const d = await svc.createDraft(ctx.ownerId, {
      projectId: ctx.projectId,
      title: "X",
    } as never);
    const updated = await svc.updateDraft(d!.id, ctx.ownerId, { title: "Y" } as never);
    expect(updated!.title).toBe("Y");
    await svc.deleteDraft(d!.id, ctx.ownerId);
    expect(await svc.listDrafts(ctx.projectId, ctx.ownerId)).toHaveLength(0);
  });
});
