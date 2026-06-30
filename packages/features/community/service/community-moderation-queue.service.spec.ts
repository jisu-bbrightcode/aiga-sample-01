/**
 * CommunityModerationService.getModerationQueue — unified admin moderation queue
 * (PB-COMM-MODERATION-API-LIST-001, DB-integration).
 *
 * Proves the BBR-620 contract:
 *  - aggregates 신고/필터/차단 from three tables into one normalized list (AC#2)
 *  - kind filter narrows to a single source
 *  - state filter (open/resolved) works across heterogeneous source statuses
 *  - communityId scoping + reason search
 *  - pagination is exact across the merged sources
 */
import {
  communityBans,
  communityFilterLogs,
  communityReports,
} from "@repo/drizzle";
import { inArray } from "drizzle-orm";
import { endTestDb, ensureUser, getDrizzleDb, hasDb, newUserId } from "../../payment/__tests__/test-db";
import { setupCommunityCtx } from "./__tests__/test-helpers";
import { CommunityModerationService } from "./community-moderation.service";
import { CommunityService } from "./community.service";

const describeIfDb = hasDb ? describe : describe.skip;
jest.setTimeout(30_000);

describeIfDb("CommunityModerationService.getModerationQueue", () => {
  let svc: CommunityModerationService;
  let ctx: Awaited<ReturnType<typeof setupCommunityCtx>>["ctx"];
  let teardown: () => Promise<void>;
  let reporter: string;
  let author: string;
  let banned: string;
  const reportIds: string[] = [];
  const filterIds: string[] = [];
  const banIds: string[] = [];

  beforeAll(() => {
    const db = getDrizzleDb();
    svc = new CommunityModerationService(db, new CommunityService(db));
  });

  beforeEach(async () => {
    const setup = await setupCommunityCtx("modq");
    ctx = setup.ctx;
    teardown = setup.teardown;
    const db = getDrizzleDb();

    reporter = newUserId("modq-reporter");
    author = newUserId("modq-author");
    banned = newUserId("modq-banned");
    await Promise.all([ensureUser(reporter), ensureUser(author), ensureUser(banned)]);

    // 신고 — 1 pending (open), 1 resolved.
    const reports = await db
      .insert(communityReports)
      .values([
        {
          communityId: ctx.communityId,
          reporterId: reporter,
          targetType: "post",
          targetId: "00000000-0000-0000-0000-0000000000a1",
          reason: "spam",
          description: "스팸 광고 신고",
          status: "pending",
          severity: "high",
        },
        {
          communityId: ctx.communityId,
          reporterId: reporter,
          targetType: "comment",
          targetId: "00000000-0000-0000-0000-0000000000a2",
          reason: "harassment",
          description: "괴롭힘 신고",
          status: "resolved",
          severity: "medium",
        },
      ])
      .returning({ id: communityReports.id });
    reportIds.push(...reports.map((r) => r.id));

    // 필터 — 1 hidden_for_review/pending (open, 숨김 후보), 1 blocked/rejected (resolved, 차단).
    const filters = await db
      .insert(communityFilterLogs)
      .values([
        {
          communityId: ctx.communityId,
          authorId: author,
          targetType: "post",
          targetId: "00000000-0000-0000-0000-0000000000b1",
          ruleType: "keyword",
          action: "hidden_for_review",
          reason: "금지어 포함",
          reviewStatus: "pending",
        },
        {
          communityId: ctx.communityId,
          authorId: author,
          ruleType: "link",
          action: "blocked",
          reason: "허용되지 않은 링크",
          reviewStatus: "rejected",
        },
      ])
      .returning({ id: communityFilterLogs.id });
    filterIds.push(...filters.map((f) => f.id));

    // 차단 — 1 permanent ban (open/active).
    const bans = await db
      .insert(communityBans)
      .values({
        communityId: ctx.communityId,
        userId: banned,
        bannedBy: ctx.ownerId,
        reason: "반복적인 스팸",
        isPermanent: true,
      })
      .returning({ id: communityBans.id });
    banIds.push(...bans.map((b) => b.id));
  });

  afterEach(async () => {
    const db = getDrizzleDb();
    if (banIds.length) await db.delete(communityBans).where(inArray(communityBans.id, banIds));
    if (filterIds.length)
      await db.delete(communityFilterLogs).where(inArray(communityFilterLogs.id, filterIds));
    if (reportIds.length)
      await db.delete(communityReports).where(inArray(communityReports.id, reportIds));
    reportIds.length = 0;
    filterIds.length = 0;
    banIds.length = 0;
    await teardown();
  });

  afterAll(async () => {
    await endTestDb();
  });

  it("aggregates report/filter/ban into one normalized list (AC#2)", async () => {
    const res = await svc.getModerationQueue({ communityId: ctx.communityId, limit: 50 });
    expect(res.total).toBe(5);
    const kinds = res.items.map((i) => i.kind).sort();
    expect(kinds).toEqual(["ban", "filter", "filter", "report", "report"]);
    // every item carries both normalized state and raw source status
    for (const item of res.items) {
      expect(item.state === "open" || item.state === "resolved").toBe(true);
      expect(typeof item.status).toBe("string");
    }
    const ban = res.items.find((i) => i.kind === "ban");
    expect(ban).toMatchObject({ targetType: "user", targetId: banned, status: "active", state: "open" });
  });

  it("narrows to a single source with the kind filter", async () => {
    const res = await svc.getModerationQueue({ communityId: ctx.communityId, kind: "filter" });
    expect(res.total).toBe(2);
    expect(res.items.every((i) => i.kind === "filter")).toBe(true);
    const hidden = res.items.find((i) => i.action === "hidden_for_review");
    expect(hidden).toMatchObject({ state: "open", status: "pending", ruleType: "keyword" });
  });

  it("filters by normalized open/resolved state across sources", async () => {
    const open = await svc.getModerationQueue({ communityId: ctx.communityId, state: "open", limit: 50 });
    // open: pending report + pending filter + active ban = 3
    expect(open.total).toBe(3);
    expect(open.items.every((i) => i.state === "open")).toBe(true);

    const resolved = await svc.getModerationQueue({
      communityId: ctx.communityId,
      state: "resolved",
      limit: 50,
    });
    // resolved: resolved report + rejected filter = 2
    expect(resolved.total).toBe(2);
    expect(resolved.items.every((i) => i.state === "resolved")).toBe(true);
  });

  it("matches the reason/description with search", async () => {
    const res = await svc.getModerationQueue({ communityId: ctx.communityId, search: "스팸", limit: 50 });
    // "스팸 광고 신고" (report) + "반복적인 스팸" (ban) = 2
    expect(res.total).toBe(2);
    expect(res.items.map((i) => i.kind).sort()).toEqual(["ban", "report"]);
  });

  it("paginates the merged queue exactly", async () => {
    const page1 = await svc.getModerationQueue({ communityId: ctx.communityId, page: 1, limit: 2 });
    const page2 = await svc.getModerationQueue({ communityId: ctx.communityId, page: 2, limit: 2 });
    const page3 = await svc.getModerationQueue({ communityId: ctx.communityId, page: 3, limit: 2 });
    expect(page1.items).toHaveLength(2);
    expect(page2.items).toHaveLength(2);
    expect(page3.items).toHaveLength(1);
    expect(page1.totalPages).toBe(3);
    // no overlap across pages
    const ids = [...page1.items, ...page2.items, ...page3.items].map((i) => `${i.kind}:${i.id}`);
    expect(new Set(ids).size).toBe(5);
    // global ordering: newest-first by createdAt
    const allCreated = [...page1.items, ...page2.items, ...page3.items].map((i) => i.createdAt);
    const sorted = [...allCreated].sort().reverse();
    expect(allCreated).toEqual(sorted);
  });

  it("scopes results to the requested community", async () => {
    const other = await setupCommunityCtx("modq-other");
    try {
      const res = await svc.getModerationQueue({ communityId: other.ctx.communityId });
      expect(res.total).toBe(0);
      expect(res.items).toEqual([]);
    } finally {
      await other.teardown();
    }
  });
});
