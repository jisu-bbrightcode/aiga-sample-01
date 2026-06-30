/**
 * CommunityCommentService — 운영 액션(ops) 통합 테스트
 * (PB-COMM-COMMENT-OPS-API-001 / BBR-604).
 *
 * remove / sticky / distinguish 의 상태 전이, 감사 로그(community_mod_logs) 기록,
 * 대댓글 depth 제한, 고정-우선 정렬을 실제 테스트 DB 에 대해 검증한다.
 * 권한/세팅은 community-comment.service.spec.ts 와 동일한 패턴을 따른다.
 */

import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { RateLimitService } from "@repo/core/rate-limit";
import {
  communityComments,
  communityMemberships,
  communityModLogs,
  communityPosts,
} from "@repo/drizzle";
import { and, eq } from "drizzle-orm";
import { endTestDb, getDrizzleDb, hasDb } from "../../payment/__tests__/test-db";
import { addExtraMember, cleanupExtraMember, setupCommunityCtx } from "./__tests__/test-helpers";
import { MAX_COMMENT_DEPTH } from "./comment-ops-policy";
import { CommunityService } from "./community.service";
import { CommunityCommentService } from "./community-comment.service";
import { CommunityContentModerationService } from "./community-content-moderation.service";
import { CommunityKeywordFilterService } from "./community-keyword-filter.service";
import { CommunityTierService } from "./community-tier.service";

const describeIfDb = hasDb ? describe : describe.skip;
jest.setTimeout(30_000);

describeIfDb("CommunityCommentService — ops actions", () => {
  let svc: CommunityCommentService;
  let ctx: Awaited<ReturnType<typeof setupCommunityCtx>>["ctx"];
  let author: string;
  let postId: string;
  let teardown: () => Promise<void>;

  beforeAll(() => {
    delete process.env.OPENAI_API_KEY;
    process.env.RATE_LIMIT_ENABLED = "false";
    const db = getDrizzleDb();
    const community = new CommunityService(db);
    const keyword = new CommunityKeywordFilterService(db);
    const tier = new CommunityTierService(db);
    const mod = new CommunityContentModerationService();
    const rateLimit = new RateLimitService(db);
    svc = new CommunityCommentService(db, community, keyword, tier, mod, rateLimit);
  });

  beforeEach(async () => {
    const setup = await setupCommunityCtx("cmtops");
    ctx = setup.ctx;
    teardown = setup.teardown;
    author = await addExtraMember("cmtops", ctx.communityId);

    const [post] = await getDrizzleDb()
      .insert(communityPosts)
      .values({ communityId: ctx.communityId, authorId: ctx.ownerId, title: "topic" })
      .returning({ id: communityPosts.id });
    postId = post!.id;
  });

  afterEach(async () => {
    const db = getDrizzleDb();
    await db.delete(communityComments).where(eq(communityComments.postId, postId));
    await db.delete(communityPosts).where(eq(communityPosts.id, postId));
    await db.delete(communityMemberships).where(eq(communityMemberships.userId, author));
    await cleanupExtraMember(author);
    await teardown(); // community cascade → community_mod_logs 정리
  });

  afterAll(async () => {
    await endTestDb();
  });

  const modLogsFor = (commentId: string) =>
    getDrizzleDb()
      .select()
      .from(communityModLogs)
      .where(
        and(
          eq(communityModLogs.communityId, ctx.communityId),
          eq(communityModLogs.targetId, commentId),
        ),
      );

  // --- reply depth (AC#2) -------------------------------------------------

  it("대댓글을 MAX_COMMENT_DEPTH 까지 허용하고 그 이상은 400 으로 거부한다", async () => {
    let parentId: string | undefined;
    let lastDepth = -1;
    // depth 0 .. MAX_COMMENT_DEPTH 까지 생성
    for (let i = 0; i <= MAX_COMMENT_DEPTH; i++) {
      const c = await svc.create({ postId, content: `d${i}`, parentId } as never, author);
      expect(c.depth).toBe(i);
      parentId = c.id;
      lastDepth = c.depth;
    }
    expect(lastDepth).toBe(MAX_COMMENT_DEPTH);

    // MAX_COMMENT_DEPTH 댓글에 답글 → depth 초과 → 400
    await expect(
      svc.create({ postId, content: "too deep", parentId } as never, author),
    ).rejects.toThrow(BadRequestException);
  });

  // --- remove (AC#1) ------------------------------------------------------

  it("remove() 는 isRemoved 를 세팅하고 remove_comment 감사 로그를 남긴다", async () => {
    const c = await svc.create({ postId, content: "spam" } as never, author);
    const removed = await svc.remove(c.id, "규칙 위반", ctx.ownerId);
    expect(removed.isRemoved).toBe(true);
    expect(removed.removedBy).toBe(ctx.ownerId);

    const logs = await modLogsFor(c.id);
    expect(logs).toHaveLength(1);
    expect(logs[0]?.action).toBe("remove_comment");
    expect(logs[0]?.targetType).toBe("comment");
    expect(logs[0]?.reason).toBe("규칙 위반");
  });

  it("remove() 는 모더레이터가 아니면 거부한다", async () => {
    const c = await svc.create({ postId, content: "hi" } as never, author);
    await expect(svc.remove(c.id, "x", author)).rejects.toThrow(ForbiddenException);
  });

  // --- sticky (AC#1) ------------------------------------------------------

  it("sticky() 는 설정/해제를 토글하고 각각 감사 로그를 남긴다", async () => {
    const c = await svc.create({ postId, content: "pinned" } as never, author);

    const on = await svc.sticky(c.id, ctx.ownerId);
    expect(on.isStickied).toBe(true);

    const off = await svc.sticky(c.id, ctx.ownerId);
    expect(off.isStickied).toBe(false);

    // 명시적 설정도 동작
    const onAgain = await svc.sticky(c.id, ctx.ownerId, true);
    expect(onAgain.isStickied).toBe(true);

    const logs = await modLogsFor(c.id);
    expect(logs).toHaveLength(3);
    expect(logs.every((l) => l.action === "other")).toBe(true);
  });

  it("고정 댓글은 작성순과 무관하게 목록 상단에 정렬된다(정렬 계약)", async () => {
    const first = await svc.create({ postId, content: "first" } as never, author);
    const second = await svc.create({ postId, content: "second" } as never, author);
    // 나중에 작성된 댓글을 고정 → 기본(old) 정렬에서도 상단에 와야 한다
    await svc.sticky(second.id, ctx.ownerId, true);

    const list = await svc.findByPost({ postId });
    expect(list.items[0]?.id).toBe(second.id);
    expect(list.items[1]?.id).toBe(first.id);
  });

  // --- distinguish (AC#1) -------------------------------------------------

  it("distinguish() 는 자신의 댓글에만 적용되고 토글 + 감사 로그를 남긴다", async () => {
    // 모더레이터(owner) 자신의 댓글
    const c = await svc.create({ postId, content: "official" } as never, ctx.ownerId);

    const marked = await svc.distinguish(c.id, ctx.ownerId);
    expect(marked.distinguished).toBe("moderator");

    const cleared = await svc.distinguish(c.id, ctx.ownerId);
    expect(cleared.distinguished).toBeNull();

    const logs = await modLogsFor(c.id);
    expect(logs).toHaveLength(2);
  });

  it("distinguish() 는 타인의 댓글에 대해 거부한다", async () => {
    const c = await svc.create({ postId, content: "member comment" } as never, author);
    await expect(svc.distinguish(c.id, ctx.ownerId)).rejects.toThrow(ForbiddenException);
  });
});
