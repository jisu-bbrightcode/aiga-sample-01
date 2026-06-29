import { NotFoundException } from "@nestjs/common";
import { endTestDb, getDrizzleDb, hasDb } from "../../payment/__tests__/test-db";
import { setupStoryCtx, type StoryTestCtx } from "./__tests__/test-helpers";
import { StoryEntityTagService } from "./entity-tag.service";
import { StoryTagService } from "./tag.service";
import { StoryWorldService } from "./world.service";

const describeIfDb = hasDb ? describe : describe.skip;
jest.setTimeout(30_000);

describeIfDb("StoryEntityTagService", () => {
  let svc: StoryEntityTagService;
  let tags: StoryTagService;
  let worlds: StoryWorldService;
  let ctx: StoryTestCtx;
  let teardown: () => Promise<void>;

  beforeAll(() => {
    const db = getDrizzleDb();
    svc = new StoryEntityTagService(db);
    tags = new StoryTagService(db);
    worlds = new StoryWorldService(db);
  });

  beforeEach(async () => {
    const setup = await setupStoryCtx("etag");
    ctx = setup.ctx;
    teardown = setup.teardown;
  });

  afterEach(async () => {
    await teardown();
  });

  afterAll(async () => {
    await endTestDb();
  });

  it("addEntityTag() links a tag to an entity (world)", async () => {
    const world = await worlds.createWorld(ctx.ownerId, {
      projectId: ctx.projectId,
      name: "World A",
    } as never);
    const tag = await tags.createTag({ projectId: ctx.projectId, name: "Lore" } as never);

    const link = await svc.addEntityTag(world!.id, "world", tag!.id);
    expect(link?.entityId).toBe(world!.id);
    expect(link?.tagId).toBe(tag!.id);

    const list = await svc.getEntityTags(world!.id, "world");
    expect(list).toHaveLength(1);
    expect(list[0]?.tag?.name).toBe("Lore");
  });

  it("addEntityTag() throws NotFoundException for unknown tag", async () => {
    await expect(
      svc.addEntityTag(
        "00000000-0000-0000-0000-000000000000",
        "world",
        "11111111-1111-1111-1111-111111111111",
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it("removeEntityTag() soft-deletes the link", async () => {
    const world = await worlds.createWorld(ctx.ownerId, {
      projectId: ctx.projectId,
      name: "World A",
    } as never);
    const tag = await tags.createTag({ projectId: ctx.projectId, name: "Lore" } as never);
    const link = await svc.addEntityTag(world!.id, "world", tag!.id);
    await svc.removeEntityTag(link!.id);
    expect(await svc.getEntityTags(world!.id, "world")).toHaveLength(0);
  });
});
