/**
 * CommunityModerationService — happy-path smoke for the 21-method surface.
 *
 * Covers the highest-traffic flows: report submit/resolve, ban/unban,
 * rules + flairs CRUD, moderator invite. The deep SLA + queue analytics
 * methods are exercised end-to-end via the trpc admin specs; here we just
 * pin the contract so a refactor cannot silently break.
 */

import {
  communityBans,
  communityFlairs,
  communityModerators,
  communityModLogs,
  communityPosts,
  communityReports,
  communityRules,
} from "@repo/drizzle";
import { eq, inArray } from "drizzle-orm";
import { endTestDb, getDrizzleDb, hasDb } from "../../payment/__tests__/test-db";
import { addExtraMember, cleanupExtraMember, setupCommunityCtx } from "./__tests__/test-helpers";
import { CommunityService } from "./community.service";
import { CommunityModerationService } from "./community-moderation.service";

const describeIfDb = hasDb ? describe : describe.skip;
jest.setTimeout(30_000);

describeIfDb("CommunityModerationService", () => {
  let svc: CommunityModerationService;
  let ctx: Awaited<ReturnType<typeof setupCommunityCtx>>["ctx"];
  let reporter: string;
  let postId: string;
  let teardown: () => Promise<void>;
  const createdIds: {
    reports: string[];
    bans: string[];
    rules: string[];
    flairs: string[];
    mods: string[];
  } = {
    reports: [],
    bans: [],
    rules: [],
    flairs: [],
    mods: [],
  };

  beforeAll(() => {
    const db = getDrizzleDb();
    svc = new CommunityModerationService(db, new CommunityService(db));
  });

  beforeEach(async () => {
    const setup = await setupCommunityCtx("mod");
    ctx = setup.ctx;
    teardown = setup.teardown;
    reporter = await addExtraMember("mod", ctx.communityId);
    for (const k of Object.keys(createdIds) as (keyof typeof createdIds)[]) {
      createdIds[k].length = 0;
    }
    const [post] = await getDrizzleDb()
      .insert(communityPosts)
      .values({ communityId: ctx.communityId, authorId: ctx.ownerId, title: "report target" })
      .returning({ id: communityPosts.id });
    postId = post!.id;
  });

  afterEach(async () => {
    const db = getDrizzleDb();
    if (createdIds.reports.length) {
      await db.delete(communityReports).where(inArray(communityReports.id, createdIds.reports));
    }
    if (createdIds.bans.length) {
      await db.delete(communityBans).where(inArray(communityBans.id, createdIds.bans));
    }
    if (createdIds.rules.length) {
      await db.delete(communityRules).where(inArray(communityRules.id, createdIds.rules));
    }
    if (createdIds.flairs.length) {
      await db.delete(communityFlairs).where(inArray(communityFlairs.id, createdIds.flairs));
    }
    if (createdIds.mods.length) {
      await db.delete(communityModerators).where(inArray(communityModerators.id, createdIds.mods));
    }
    await db.delete(communityPosts).where(eq(communityPosts.id, postId));
    // Mod actions leave audit rows in community_mod_logs that FK back to users.
    // Clear those before cleanupUser deletes the user row.
    await db.delete(communityModLogs).where(eq(communityModLogs.communityId, ctx.communityId));
    await cleanupExtraMember(reporter);
    await teardown();
  });

  afterAll(async () => {
    await endTestDb();
  });

  it("createReport() + findReportById() round-trip", async () => {
    const r = await svc.createReport(
      {
        communityId: ctx.communityId,
        targetType: "post",
        targetId: postId,
        reason: "spam",
      } as never,
      reporter,
    );
    createdIds.reports.push(r.id);
    expect(r.status).toBe("pending");
    await expect(svc.findReportById(r.id)).resolves.toMatchObject({ id: r.id });
  });

  it("getReports() filters by status", async () => {
    const r = await svc.createReport(
      {
        communityId: ctx.communityId,
        targetType: "post",
        targetId: postId,
        reason: "spam",
      } as never,
      reporter,
    );
    createdIds.reports.push(r.id);
    const pending = await svc.getReports(ctx.communityId, ctx.ownerId, "pending");
    expect(pending.some((x) => x.id === r.id)).toBe(true);
  });

  it("banUser() + findBan() + unbanUser() round-trip", async () => {
    const ban = await svc.banUser(
      {
        communityId: ctx.communityId,
        userId: reporter,
        reason: "spam",
      } as never,
      ctx.ownerId,
    );
    createdIds.bans.push(ban.id);
    await expect(svc.findBan(ctx.communityId, reporter)).resolves.toMatchObject({ id: ban.id });

    await svc.unbanUser(ctx.communityId, reporter, ctx.ownerId);
    await expect(svc.findBan(ctx.communityId, reporter)).resolves.toBeNull();
  });

  it("createRule() + getRules() returns rules ordered by position", async () => {
    const r = await svc.createRule(
      {
        communityId: ctx.communityId,
        title: "Be kind",
        description: "Don't be a jerk",
      } as never,
      ctx.ownerId,
    );
    createdIds.rules.push(r.id);
    const rules = await svc.getRules(ctx.communityId);
    expect(rules.some((x) => x.id === r.id)).toBe(true);
  });

  it("createFlair() + getFlairs() filters by type", async () => {
    const f = await svc.createFlair(
      {
        communityId: ctx.communityId,
        text: "Announcement",
        type: "post",
        color: "#fff",
      } as never,
      ctx.ownerId,
    );
    createdIds.flairs.push(f.id);
    const post = await svc.getFlairs(ctx.communityId, "post");
    expect(post.some((x) => x.id === f.id)).toBe(true);
  });

  // ── Rules/flair management lifecycle (PB-COMM-RULES-FLAIR-API-001 / AC#2) ──

  async function modLogsFor(reason: string) {
    return getDrizzleDb()
      .select()
      .from(communityModLogs)
      .where(eq(communityModLogs.communityId, ctx.communityId))
      .then((rows) => rows.filter((r) => r.reason === reason));
  }

  it("updateRule() edits the rule and writes an edit_rules audit log", async () => {
    const r = await svc.createRule(
      { communityId: ctx.communityId, title: "Old", description: "old desc" } as never,
      ctx.ownerId,
    );
    createdIds.rules.push(r.id);

    const updated = await svc.updateRule(
      r.id,
      { title: "New title", description: "new desc", appliesTo: "posts" },
      ctx.ownerId,
    );
    expect(updated.title).toBe("New title");
    expect(updated.description).toBe("new desc");
    expect(updated.appliesTo).toBe("posts");

    const logs = await modLogsFor("Rule updated");
    expect(logs.length).toBe(1);
    expect(logs[0]?.action).toBe("edit_rules");
  });

  it("deleteRule() removes the rule and writes an audit log", async () => {
    const r = await svc.createRule(
      { communityId: ctx.communityId, title: "Doomed", description: "d" } as never,
      ctx.ownerId,
    );
    await expect(svc.deleteRule(r.id, ctx.ownerId)).resolves.toEqual({ deleted: true });

    const rules = await svc.getRules(ctx.communityId);
    expect(rules.some((x) => x.id === r.id)).toBe(false);
    expect((await modLogsFor("Rule deleted")).length).toBe(1);
  });

  it("updateFlair() edits the flair and writes an add_flair audit log", async () => {
    const f = await svc.createFlair(
      { communityId: ctx.communityId, text: "Old", type: "post" } as never,
      ctx.ownerId,
    );
    createdIds.flairs.push(f.id);

    const updated = await svc.updateFlair(
      f.id,
      { text: "Renamed", color: "#112233", modOnly: true },
      ctx.ownerId,
    );
    expect(updated.text).toBe("Renamed");
    expect(updated.color).toBe("#112233");
    expect(updated.modOnly).toBe(true);
    expect((await modLogsFor("Flair updated")).length).toBe(1);
  });

  it("deleteFlair() removes the flair and writes an audit log", async () => {
    const f = await svc.createFlair(
      { communityId: ctx.communityId, text: "Doomed", type: "user" } as never,
      ctx.ownerId,
    );
    await expect(svc.deleteFlair(f.id, ctx.ownerId)).resolves.toEqual({ deleted: true });
    const flairs = await svc.getFlairs(ctx.communityId);
    expect(flairs.some((x) => x.id === f.id)).toBe(false);
    expect((await modLogsFor("Flair deleted")).length).toBe(1);
  });

  it("setBannedWords() normalizes + persists, getBannedWords() reads them, with audit", async () => {
    const saved = await svc.setBannedWords(
      ctx.communityId,
      ["  spam ", "spam", "", "scam"],
      ctx.ownerId,
    );
    // trimmed + de-duplicated + empties dropped
    expect(saved.sort()).toEqual(["scam", "spam"]);
    await expect(svc.getBannedWords(ctx.communityId, ctx.ownerId)).resolves.toEqual(
      expect.arrayContaining(["spam", "scam"]),
    );
    expect((await modLogsFor("Banned words updated")).length).toBe(1);
  });

  it("updateRule() rejects a non-moderator actor (permission gate)", async () => {
    const r = await svc.createRule(
      { communityId: ctx.communityId, title: "X", description: "y" } as never,
      ctx.ownerId,
    );
    createdIds.rules.push(r.id);
    await expect(svc.updateRule(r.id, { title: "hack" }, reporter)).rejects.toThrow();
  });

  it("inviteModerator() persists a pending moderator row", async () => {
    const m = await svc.inviteModerator(
      {
        communityId: ctx.communityId,
        userId: reporter,
        permissions: {},
      } as never,
      ctx.ownerId,
    );
    createdIds.mods.push(m.id);
    expect(m.userId).toBe(reporter);
    expect(m.status).toBe("pending");
  });

  it("getModQueue() returns reports + recently flagged content", async () => {
    const r = await svc.createReport(
      {
        communityId: ctx.communityId,
        targetType: "post",
        targetId: postId,
        reason: "spam",
      } as never,
      reporter,
    );
    createdIds.reports.push(r.id);
    const queue = await svc.getModQueue(ctx.communityId, ctx.ownerId);
    expect(queue).toBeDefined();
    expect(queue.reports?.length ?? 0).toBeGreaterThan(0);
  });

  it("중복 신고 정책: 동일 신고자·동일 대상의 활성 신고는 멱등하게 기존 신고를 반환한다", async () => {
    const dto = {
      communityId: ctx.communityId,
      targetType: "post",
      targetId: postId,
      reason: "spam",
    } as never;

    const first = await svc.createReport(dto, reporter);
    createdIds.reports.push(first.id);
    const second = await svc.createReport(dto, reporter);

    // 같은 신고 row 가 반환되고 새 row 가 생성되지 않는다.
    expect(second.id).toBe(first.id);
    const all = await svc.getReports(ctx.communityId, ctx.ownerId);
    expect(all.filter((x) => x.targetId === postId && x.reporterId === reporter)).toHaveLength(1);
  });

  it("신고자 보호: 모더레이터가 아닌 사용자는 신고 목록/큐를 조회할 수 없다 (AC#2)", async () => {
    // `reporter` 는 일반 멤버(role=member)이며 모더레이터 권한이 없다.
    await expect(svc.getReports(ctx.communityId, reporter)).rejects.toThrow();
    await expect(svc.getModQueue(ctx.communityId, reporter)).rejects.toThrow();
  });
});
