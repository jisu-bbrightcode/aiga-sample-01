import { userKarma } from "@repo/drizzle";
import { inArray } from "drizzle-orm";
import {
  cleanupUser,
  endTestDb,
  ensureUser,
  getDrizzleDb,
  hasDb,
  newUserId,
} from "../../payment/__tests__/test-db";
import { CommunityKarmaService } from "./community-karma.service";

const describeIfDb = hasDb ? describe : describe.skip;
jest.setTimeout(30_000);

describeIfDb("CommunityKarmaService", () => {
  let svc: CommunityKarmaService;
  let userIds: string[] = [];

  beforeAll(() => {
    svc = new CommunityKarmaService(getDrizzleDb());
  });

  afterEach(async () => {
    const db = getDrizzleDb();
    if (userIds.length > 0) {
      await db.delete(userKarma).where(inArray(userKarma.userId, userIds));
      for (const id of userIds) await cleanupUser(id);
    }
    userIds = [];
  });

  afterAll(async () => {
    await endTestDb();
  });

  it("getKarma() returns zeros for a user with no karma row", async () => {
    const userId = newUserId("karma-zero");
    userIds.push(userId);
    await ensureUser(userId);
    const result = await svc.getKarma(userId);
    expect(result).toEqual({ userId, postKarma: 0, commentKarma: 0, totalKarma: 0 });
  });

  it("getKarma() returns the persisted row when one exists", async () => {
    const userId = newUserId("karma-real");
    userIds.push(userId);
    await ensureUser(userId);
    await getDrizzleDb()
      .insert(userKarma)
      .values({ userId, postKarma: 12, commentKarma: 7, totalKarma: 19 });
    const result = await svc.getKarma(userId);
    expect(result).toEqual({ userId, postKarma: 12, commentKarma: 7, totalKarma: 19 });
  });

  it("getBatchKarma() returns one entry per requested userId, defaults for misses", async () => {
    const a = newUserId("karma-batch-a");
    const b = newUserId("karma-batch-b");
    userIds.push(a, b);
    await ensureUser(a);
    await ensureUser(b);
    await getDrizzleDb()
      .insert(userKarma)
      .values({ userId: a, postKarma: 5, commentKarma: 3, totalKarma: 8 });

    const result = await svc.getBatchKarma([a, b, a]); // duplicate input
    expect(result).toHaveLength(2);
    const byUser = new Map(result.map((r) => [r.userId, r]));
    expect(byUser.get(a)).toEqual({ userId: a, postKarma: 5, commentKarma: 3, totalKarma: 8 });
    expect(byUser.get(b)).toEqual({ userId: b, postKarma: 0, commentKarma: 0, totalKarma: 0 });
  });

  it("getBatchKarma() returns [] for an empty array (no SQL roundtrip)", async () => {
    await expect(svc.getBatchKarma([])).resolves.toEqual([]);
  });
});
