import { endTestDb, getDrizzleDb, hasDb } from "../../payment/__tests__/test-db";
import { setupStoryCtx, type StoryTestCtx } from "./__tests__/test-helpers";
import { StoryTagService } from "./tag.service";

const describeIfDb = hasDb ? describe : describe.skip;
jest.setTimeout(30_000);

describeIfDb("StoryTagService", () => {
  let svc: StoryTagService;
  let ctx: StoryTestCtx;
  let teardown: () => Promise<void>;

  beforeAll(() => {
    svc = new StoryTagService(getDrizzleDb());
  });

  beforeEach(async () => {
    const setup = await setupStoryCtx("tag");
    ctx = setup.ctx;
    teardown = setup.teardown;
  });

  afterEach(async () => {
    await teardown();
  });

  afterAll(async () => {
    await endTestDb();
  });

  it("createTag() persists a new tag", async () => {
    const t = await svc.createTag({
      projectId: ctx.projectId,
      name: "Hero",
      color: "#ff0000",
    } as never);
    expect(t?.name).toBe("Hero");
    expect(t?.color).toBe("#ff0000");
  });

  it("createTag() returns the existing row when the same name is reused (dedupe)", async () => {
    const first = await svc.createTag({
      projectId: ctx.projectId,
      name: "Hero",
      color: "#ff0000",
    } as never);
    const dup = await svc.createTag({
      projectId: ctx.projectId,
      name: "Hero",
      color: "#00ff00",
    } as never);
    expect(dup!.id).toBe(first!.id);
    expect(dup!.color).toBe("#ff0000"); // original color preserved
  });

  it("listTags() returns active tags ordered by name", async () => {
    await svc.createTag({ projectId: ctx.projectId, name: "Beta" } as never);
    await svc.createTag({ projectId: ctx.projectId, name: "Alpha" } as never);
    const rows = await svc.listTags(ctx.projectId);
    expect(rows.map((t) => t.name)).toEqual(["Alpha", "Beta"]);
  });

  it("deleteTag() soft-deletes (listTags excludes)", async () => {
    const t = await svc.createTag({ projectId: ctx.projectId, name: "Hero" } as never);
    await svc.deleteTag(t!.id);
    expect(await svc.listTags(ctx.projectId)).toHaveLength(0);
  });
});
