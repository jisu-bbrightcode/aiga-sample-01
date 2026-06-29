import { endTestDb, getDrizzleDb, hasDb } from "../../payment/__tests__/test-db";
import { setupStoryCtx, type StoryTestCtx } from "./__tests__/test-helpers";
import { StoryCharacterService } from "./character.service";
import { StoryRelationService } from "./relation.service";
import { StoryWorldService } from "./world.service";

const describeIfDb = hasDb ? describe : describe.skip;
jest.setTimeout(30_000);

describeIfDb("StoryRelationService", () => {
  let svc: StoryRelationService;
  let worlds: StoryWorldService;
  let chars: StoryCharacterService;
  let ctx: StoryTestCtx;
  let teardown: () => Promise<void>;

  beforeAll(() => {
    const db = getDrizzleDb();
    svc = new StoryRelationService(db);
    worlds = new StoryWorldService(db);
    chars = new StoryCharacterService(db);
  });

  beforeEach(async () => {
    const setup = await setupStoryCtx("rel");
    ctx = setup.ctx;
    teardown = setup.teardown;
  });

  afterEach(async () => {
    await teardown();
  });

  afterAll(async () => {
    await endTestDb();
  });

  it("createRelation() persists and lists bidirectionally with name lookup", async () => {
    const world = await worlds.createWorld(ctx.ownerId, {
      projectId: ctx.projectId,
      name: "Aether",
    } as never);
    const character = await chars.createCharacter(ctx.ownerId, {
      projectId: ctx.projectId,
      name: "Lyra",
    } as never);
    const rel = await svc.createRelation({
      projectId: ctx.projectId,
      sourceId: world!.id,
      sourceType: "world",
      targetId: character!.id,
      targetType: "character",
      label: "creator-of",
    } as never);
    expect(rel?.label).toBe("creator-of");

    // From the world side: target is the character, name resolved.
    const fromWorld = await svc.listRelations(world!.id, "world");
    expect(fromWorld).toHaveLength(1);
    expect(fromWorld[0]?.targetEntityId).toBe(character!.id);
    expect(fromWorld[0]?.targetEntityName).toBe("Lyra");

    // From the character side: target is the world (other side).
    const fromChar = await svc.listRelations(character!.id, "character");
    expect(fromChar).toHaveLength(1);
    expect(fromChar[0]?.targetEntityId).toBe(world!.id);
    expect(fromChar[0]?.targetEntityName).toBe("Aether");
  });

  it("createRelation() de-duplicates pairs in either direction", async () => {
    const a = await worlds.createWorld(ctx.ownerId, {
      projectId: ctx.projectId,
      name: "A",
    } as never);
    const b = await worlds.createWorld(ctx.ownerId, {
      projectId: ctx.projectId,
      name: "B",
    } as never);
    const first = await svc.createRelation({
      projectId: ctx.projectId,
      sourceId: a!.id,
      sourceType: "world",
      targetId: b!.id,
      targetType: "world",
      label: "first",
    } as never);
    // Reverse direction — should return the existing row, not create a new one.
    const reverse = await svc.createRelation({
      projectId: ctx.projectId,
      sourceId: b!.id,
      sourceType: "world",
      targetId: a!.id,
      targetType: "world",
      label: "duplicate",
    } as never);
    expect(reverse?.id).toBe(first?.id);
    expect(reverse?.label).toBe("first"); // original label preserved
  });

  it("deleteRelation() soft-deletes (list excludes)", async () => {
    const a = await worlds.createWorld(ctx.ownerId, {
      projectId: ctx.projectId,
      name: "A",
    } as never);
    const b = await worlds.createWorld(ctx.ownerId, {
      projectId: ctx.projectId,
      name: "B",
    } as never);
    const rel = await svc.createRelation({
      projectId: ctx.projectId,
      sourceId: a!.id,
      sourceType: "world",
      targetId: b!.id,
      targetType: "world",
    } as never);
    await svc.deleteRelation(rel!.id);
    expect(await svc.listRelations(a!.id, "world")).toHaveLength(0);
  });
});
