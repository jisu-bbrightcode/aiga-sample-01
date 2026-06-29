import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { endTestDb, getDrizzleDb, hasDb } from "../../payment/__tests__/test-db";
import { setupStoryCtx, type StoryTestCtx } from "./__tests__/test-helpers";
import { StoryCharacterService } from "./character.service";
import { StoryCodexService } from "./codex.service";
import { StoryDraftService } from "./draft.service";
import { StoryEntityPropertyService } from "./entity-property.service";
import { StoryFactionService } from "./faction.service";
import { StoryLocationService } from "./location.service";
import { StoryWorldService } from "./world.service";

jest.mock("@repo/core/storage/blob", () => ({
  uploadBufferToBlob: jest.fn(async (_b, _k, _ct, _opts) => ({
    url: "https://blob.test/image-small.png",
    size: 4096,
  })),
}));

const describeIfDb = hasDb ? describe : describe.skip;
jest.setTimeout(30_000);

describeIfDb("StoryEntityPropertyService", () => {
  let svc: StoryEntityPropertyService;
  let worlds: StoryWorldService;
  let ctx: StoryTestCtx;
  let teardown: () => Promise<void>;

  beforeAll(() => {
    const db = getDrizzleDb();
    worlds = new StoryWorldService(db);
    svc = new StoryEntityPropertyService(
      db,
      worlds,
      new StoryCharacterService(db),
      new StoryLocationService(db),
      new StoryFactionService(db),
      new StoryCodexService(db),
      new StoryDraftService(db),
    );
  });

  beforeEach(async () => {
    const setup = await setupStoryCtx("prop");
    ctx = setup.ctx;
    teardown = setup.teardown;
  });

  afterEach(async () => {
    await teardown();
  });

  afterAll(async () => {
    await endTestDb();
  });

  it("getEntityProperties() returns an empty stub when no row exists yet", async () => {
    const world = await worlds.createWorld(ctx.ownerId, {
      projectId: ctx.projectId,
      name: "X",
    } as never);
    const result = await svc.getEntityProperties(world!.id, "world", ctx.ownerId);
    expect(result.properties).toEqual([]);
    expect(result.entityId).toBe(world!.id);
    expect(result.projectId).toBe(ctx.projectId);
  });

  it("upsertEntityProperty() inserts then merges values for the same entity", async () => {
    const world = await worlds.createWorld(ctx.ownerId, {
      projectId: ctx.projectId,
      name: "X",
    } as never);
    const a = await svc.upsertEntityProperty({
      projectId: ctx.projectId,
      entityId: world!.id,
      entityType: "world",
      key: "color",
      value: "red",
      ownerId: ctx.ownerId,
    });
    expect(a!.properties).toEqual([{ key: "color", value: "red" }]);

    const b = await svc.upsertEntityProperty({
      projectId: ctx.projectId,
      entityId: world!.id,
      entityType: "world",
      key: "color",
      value: "blue",
      ownerId: ctx.ownerId,
    });
    expect(b!.properties).toEqual([{ key: "color", value: "blue" }]);

    const c = await svc.upsertEntityProperty({
      projectId: ctx.projectId,
      entityId: world!.id,
      entityType: "world",
      key: "size",
      value: "large",
      ownerId: ctx.ownerId,
    });
    expect(c!.properties).toEqual([
      { key: "color", value: "blue" },
      { key: "size", value: "large" },
    ]);
  });

  it("upsertEntityProperty() throws ForbiddenException when projectId mismatches the entity's project", async () => {
    const world = await worlds.createWorld(ctx.ownerId, {
      projectId: ctx.projectId,
      name: "X",
    } as never);
    await expect(
      svc.upsertEntityProperty({
        projectId: "00000000-0000-0000-0000-000000000000",
        entityId: world!.id,
        entityType: "world",
        key: "k",
        value: "v",
        ownerId: ctx.ownerId,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it("uploadEntityImageSmall() rejects unsupported content types", async () => {
    const world = await worlds.createWorld(ctx.ownerId, {
      projectId: ctx.projectId,
      name: "X",
    } as never);
    await expect(
      svc.uploadEntityImageSmall({
        projectId: ctx.projectId,
        entityId: world!.id,
        entityType: "world",
        fileName: "x.gif",
        contentType: "image/gif",
        bytesBase64: Buffer.from("x").toString("base64"),
        ownerId: ctx.ownerId,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("uploadEntityImageSmall() rejects oversize images (>5MB)", async () => {
    const world = await worlds.createWorld(ctx.ownerId, {
      projectId: ctx.projectId,
      name: "X",
    } as never);
    const big = Buffer.alloc(5 * 1024 * 1024 + 1).toString("base64");
    await expect(
      svc.uploadEntityImageSmall({
        projectId: ctx.projectId,
        entityId: world!.id,
        entityType: "world",
        fileName: "x.png",
        contentType: "image/png",
        bytesBase64: big,
        ownerId: ctx.ownerId,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("uploadEntityImageSmall() persists the blob URL via upsertEntityProperty", async () => {
    const world = await worlds.createWorld(ctx.ownerId, {
      projectId: ctx.projectId,
      name: "X",
    } as never);
    const result = await svc.uploadEntityImageSmall({
      projectId: ctx.projectId,
      entityId: world!.id,
      entityType: "world",
      fileName: "x.png",
      contentType: "image/png",
      bytesBase64: Buffer.from("png-bytes").toString("base64"),
      ownerId: ctx.ownerId,
    });
    expect(result.imageSmallUrl).toBe("https://blob.test/image-small.png");

    const props = await svc.getEntityProperties(world!.id, "world", ctx.ownerId);
    expect(props.properties).toEqual([
      { key: "imageSmallUrl", value: "https://blob.test/image-small.png" },
    ]);
  });
});
