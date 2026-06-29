import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { endTestDb, getDrizzleDb, hasDb, newUserId } from "../../payment/__tests__/test-db";
import {
  cleanupProfile,
  ensureProfile,
  setupStoryCtx,
  type StoryTestCtx,
} from "./__tests__/test-helpers";
import { StoryCharacterService } from "./character.service";

const describeIfDb = hasDb ? describe : describe.skip;
jest.setTimeout(30_000);

describeIfDb("StoryCharacterService", () => {
  let svc: StoryCharacterService;
  let ctx: StoryTestCtx;
  let teardown: () => Promise<void>;

  beforeAll(() => {
    svc = new StoryCharacterService(getDrizzleDb());
  });

  beforeEach(async () => {
    const setup = await setupStoryCtx("char");
    ctx = setup.ctx;
    teardown = setup.teardown;
  });

  afterEach(async () => {
    await teardown();
  });

  afterAll(async () => {
    await endTestDb();
  });

  it("createCharacter() persists with all domain fields including roles", async () => {
    const c = await svc.createCharacter(ctx.ownerId, {
      projectId: ctx.projectId,
      name: "Lyra",
      description: "Lead",
      age: "27",
      occupation: "Knight",
      personality: "Stoic",
      voice: "Dry",
      roles: ["protagonist"],
    } as never);
    expect(c?.name).toBe("Lyra");
    expect(c?.occupation).toBe("Knight");
    expect(c?.roles).toEqual(["protagonist"]);
  });

  it("listCharacters() supports search + sort", async () => {
    await svc.createCharacter(ctx.ownerId, {
      projectId: ctx.projectId,
      name: "Alpha",
    } as never);
    await svc.createCharacter(ctx.ownerId, {
      projectId: ctx.projectId,
      name: "Beta",
    } as never);
    const byName = await svc.listCharacters(ctx.projectId, ctx.ownerId, undefined, "name");
    expect(byName.map((c) => c.name)).toEqual(["Alpha", "Beta"]);
    const searched = await svc.listCharacters(ctx.projectId, ctx.ownerId, "alp");
    expect(searched.map((c) => c.name)).toEqual(["Alpha"]);
  });

  it("getCharacter() throws NotFound + Forbidden", async () => {
    await expect(
      svc.getCharacter("00000000-0000-0000-0000-000000000000", ctx.ownerId),
    ).rejects.toThrow(NotFoundException);
    const c = await svc.createCharacter(ctx.ownerId, {
      projectId: ctx.projectId,
      name: "X",
    } as never);
    const other = newUserId("char-other");
    await ensureProfile(other);
    try {
      await expect(svc.getCharacter(c!.id, other)).rejects.toThrow(ForbiddenException);
    } finally {
      await cleanupProfile(other);
    }
  });

  it("update + delete cycle", async () => {
    const c = await svc.createCharacter(ctx.ownerId, {
      projectId: ctx.projectId,
      name: "X",
    } as never);
    const updated = await svc.updateCharacter(c!.id, ctx.ownerId, { voice: "Warm" } as never);
    expect(updated!.voice).toBe("Warm");
    await svc.deleteCharacter(c!.id, ctx.ownerId);
    expect(await svc.listCharacters(ctx.projectId, ctx.ownerId)).toHaveLength(0);
  });
});
