import { randomUUID } from "node:crypto";
import { reactions } from "@repo/drizzle/schema";
import { and, eq } from "drizzle-orm";
import {
  cleanupUser,
  endTestDb,
  ensureUser,
  getDrizzleDb,
  hasDb,
  newUserId,
} from "../../payment/__tests__/test-db";
import { ReactionService } from "./reaction.service";

const describeIfDb = hasDb ? describe : describe.skip;
jest.setTimeout(30_000);

const TARGET_TYPE = "board_post";

describeIfDb("ReactionService.remove (idempotent delete)", () => {
  let svc: ReactionService;
  let userA: string;
  let userB: string;
  let targetId: string;

  beforeAll(() => {
    svc = new ReactionService(getDrizzleDb());
  });

  beforeEach(async () => {
    userA = newUserId("react-a");
    userB = newUserId("react-b");
    targetId = randomUUID();
    await ensureUser(userA);
    await ensureUser(userB);
  });

  afterEach(async () => {
    const db = getDrizzleDb();
    await db.delete(reactions).where(eq(reactions.targetId, targetId));
    await cleanupUser(userA);
    await cleanupUser(userB);
  });

  afterAll(async () => {
    await endTestDb();
  });

  it("removes the caller's reaction and returns removed=true with fresh counts", async () => {
    await svc.toggle(TARGET_TYPE, targetId, userA, "like");

    const result = await svc.remove(TARGET_TYPE, targetId, userA, "like");

    expect(result.removed).toBe(true);
    expect(result.counts.total).toBe(0);
    expect(result.counts.byType).toEqual([]);
  });

  // AC#1: 리액션 삭제가 여러 번 호출되어도 count가 깨지지 않는다.
  it("is idempotent — repeated deletes never break or go negative", async () => {
    await svc.toggle(TARGET_TYPE, targetId, userA, "like");

    const first = await svc.remove(TARGET_TYPE, targetId, userA, "like");
    expect(first.removed).toBe(true);
    expect(first.counts.total).toBe(0);

    // Subsequent deletes are no-ops with a stable, non-negative count.
    for (let i = 0; i < 3; i++) {
      const again = await svc.remove(TARGET_TYPE, targetId, userA, "like");
      expect(again.removed).toBe(false);
      expect(again.counts.total).toBe(0);
      expect(again.counts.total).toBeGreaterThanOrEqual(0);
    }
  });

  // AC#1 (count sync): deleting one user's reaction keeps the aggregate accurate.
  it("keeps counts accurate when one of several reactors cancels", async () => {
    await svc.toggle(TARGET_TYPE, targetId, userA, "like");
    await svc.toggle(TARGET_TYPE, targetId, userB, "like");

    const before = await svc.getReactionCounts(TARGET_TYPE, targetId);
    expect(before.total).toBe(2);

    const result = await svc.remove(TARGET_TYPE, targetId, userA, "like");
    expect(result.removed).toBe(true);
    expect(result.counts.total).toBe(1);
  });

  // AC#2: 권한 없는 사용자는 다른 사용자의 리액션을 삭제할 수 없다.
  it("only ever deletes the caller's own reaction (cannot remove another user's)", async () => {
    await svc.toggle(TARGET_TYPE, targetId, userB, "like");

    // userA attempts a delete on the same target — scoped to userA, so it is a no-op.
    const result = await svc.remove(TARGET_TYPE, targetId, userA, "like");
    expect(result.removed).toBe(false);
    expect(result.counts.total).toBe(1);

    // userB's reaction must still be present.
    const status = await svc.getUserReactionStatus(TARGET_TYPE, targetId, userB);
    expect(status.hasReacted).toBe(true);
  });

  it("removes only the named type when type is provided", async () => {
    await svc.toggle(TARGET_TYPE, targetId, userA, "like");
    await svc.toggle(TARGET_TYPE, targetId, userA, "love");

    const result = await svc.remove(TARGET_TYPE, targetId, userA, "like");
    expect(result.removed).toBe(true);
    expect(result.counts.total).toBe(1);
    expect(result.counts.byType).toEqual([{ type: "love", count: 1 }]);
  });

  it("removes every reaction the caller has on the target when type is omitted", async () => {
    await svc.toggle(TARGET_TYPE, targetId, userA, "like");
    await svc.toggle(TARGET_TYPE, targetId, userA, "love");

    const result = await svc.remove(TARGET_TYPE, targetId, userA);
    expect(result.removed).toBe(true);
    expect(result.counts.total).toBe(0);

    const remaining = await getDrizzleDb()
      .select()
      .from(reactions)
      .where(and(eq(reactions.targetId, targetId), eq(reactions.userId, userA)));
    expect(remaining).toHaveLength(0);
  });
});
