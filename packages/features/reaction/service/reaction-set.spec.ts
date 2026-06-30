/**
 * ReactionService.set — single-reaction "set" semantics (PB-COMM-REACTION-API-SET-001 / BBR-612).
 *
 * DB-gated (skips without DATABASE_URL). Covers the storage invariant that backs
 * the PUT /community/reactions endpoint:
 * - 중복 방지: at most one reaction row per (user, target) (AC#1).
 * - 타입 변경: switching type mutates the existing row, never inserts a second.
 * - idempotency: re-applying the same type is a no-op (changed=false).
 */

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

const TARGET_TYPE = "community_post";

describeIfDb("ReactionService.set (single-reaction set)", () => {
  let svc: ReactionService;
  let userA: string;
  let targetId: string;

  beforeAll(() => {
    svc = new ReactionService(getDrizzleDb());
  });

  beforeEach(async () => {
    userA = newUserId("set-a");
    targetId = randomUUID();
    await ensureUser(userA);
  });

  afterEach(async () => {
    const db = getDrizzleDb();
    await db.delete(reactions).where(eq(reactions.targetId, targetId));
    await cleanupUser(userA);
  });

  afterAll(async () => {
    await endTestDb();
  });

  async function rowCount(userId: string): Promise<number> {
    const rows = await getDrizzleDb()
      .select({ id: reactions.id })
      .from(reactions)
      .where(and(eq(reactions.targetId, targetId), eq(reactions.userId, userId)));
    return rows.length;
  }

  it("creates the first reaction (changed=true) with fresh counts", async () => {
    const result = await svc.set(TARGET_TYPE, targetId, userA, "like");

    expect(result.changed).toBe(true);
    expect(result.type).toBe("like");
    expect(result.counts.total).toBe(1);
    expect(await rowCount(userA)).toBe(1);
  });

  // AC#1: 한 사용자가 한 대상에 중복 리액션을 만들지 않는다.
  it("never creates a duplicate row for the same (user, target)", async () => {
    await svc.set(TARGET_TYPE, targetId, userA, "like");
    await svc.set(TARGET_TYPE, targetId, userA, "love");
    await svc.set(TARGET_TYPE, targetId, userA, "wow");

    expect(await rowCount(userA)).toBe(1);
  });

  it("changes the reaction type in place and keeps total at 1", async () => {
    await svc.set(TARGET_TYPE, targetId, userA, "like");
    const changed = await svc.set(TARGET_TYPE, targetId, userA, "angry");

    expect(changed.changed).toBe(true);
    expect(changed.type).toBe("angry");
    expect(changed.counts.total).toBe(1);
    expect(changed.counts.byType).toEqual([{ type: "angry", count: 1 }]);
  });

  // idempotency: 같은 타입을 다시 set 하면 no-op.
  it("is idempotent — re-setting the same type returns changed=false", async () => {
    await svc.set(TARGET_TYPE, targetId, userA, "love");
    const again = await svc.set(TARGET_TYPE, targetId, userA, "love");

    expect(again.changed).toBe(false);
    expect(again.type).toBe("love");
    expect(again.counts.total).toBe(1);
    expect(await rowCount(userA)).toBe(1);
  });
});
