import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { communityUserBlocks } from "@repo/drizzle";
import { eq, or } from "drizzle-orm";
import {
  cleanupUser,
  endTestDb,
  ensureUser,
  getDrizzleDb,
  hasDb,
  newUserId,
} from "../../payment/__tests__/test-db";
import { CommunityBlockService } from "./community-block.service";

const describeIfDb = hasDb ? describe : describe.skip;
jest.setTimeout(30_000);

describeIfDb("CommunityBlockService", () => {
  let svc: CommunityBlockService;
  let a: string;
  let b: string;

  beforeAll(() => {
    svc = new CommunityBlockService(getDrizzleDb());
  });

  beforeEach(async () => {
    a = newUserId("block-a");
    b = newUserId("block-b");
    await ensureUser(a);
    await ensureUser(b);
  });

  afterEach(async () => {
    const db = getDrizzleDb();
    await db
      .delete(communityUserBlocks)
      .where(or(eq(communityUserBlocks.blockerId, a), eq(communityUserBlocks.blockerId, b)));
    await cleanupUser(a);
    await cleanupUser(b);
  });

  afterAll(async () => {
    await endTestDb();
  });

  it("block() persists a new block row", async () => {
    const block = await svc.block(a, b);
    expect(block.blockerId).toBe(a);
    expect(block.blockedId).toBe(b);
  });

  it("block() throws ForbiddenException for self-block", async () => {
    await expect(svc.block(a, a)).rejects.toThrow(ForbiddenException);
  });

  it("block() throws ConflictException for duplicate block", async () => {
    await svc.block(a, b);
    await expect(svc.block(a, b)).rejects.toThrow(ConflictException);
  });

  it("unblock() removes the block row", async () => {
    await svc.block(a, b);
    await svc.unblock(a, b);
    await expect(svc.isBlocked(a, b)).resolves.toBe(false);
  });

  it("unblock() throws NotFoundException when no block exists", async () => {
    await expect(svc.unblock(a, b)).rejects.toThrow(NotFoundException);
  });

  it("getBlockedUserIds() returns the bidirectional set (both sides see the other id)", async () => {
    await svc.block(a, b);
    // a blocked b → both sides report the other id (mutual mute semantics).
    await expect(svc.getBlockedUserIds(a)).resolves.toEqual([b]);
    await expect(svc.getBlockedUserIds(b)).resolves.toEqual([a]);
  });

  it("getBlockList() returns full block rows", async () => {
    await svc.block(a, b);
    const list = await svc.getBlockList(a);
    expect(list).toHaveLength(1);
    expect(list[0]?.blockedId).toBe(b);
  });

  it("isBlocked() reflects current block state", async () => {
    await expect(svc.isBlocked(a, b)).resolves.toBe(false);
    await svc.block(a, b);
    await expect(svc.isBlocked(a, b)).resolves.toBe(true);
  });
});
