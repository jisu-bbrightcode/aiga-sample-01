/**
 * CommunityPollService — poll cast / remove / result visibility (BBR-605).
 *
 * Authoritative ballots live in `community_poll_votes`; aggregate counts are
 * cached back into `community_posts.poll_data`. The spec asserts:
 *   - 중복 투표 차단 (AC#1) — single & multiple choice
 *   - 종료/숨김/삭제/차단 상태가 게시글 정책과 일관 (AC#2)
 *   - 결과 공개 정책 (hidden until vote/close)
 *
 * DB-gated: skips when no Postgres test database is configured.
 */

import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import type { PollData } from "@repo/drizzle/schema";
import { communityMemberships, communityPollVotes, communityPosts } from "@repo/drizzle";
import { eq } from "drizzle-orm";
import { endTestDb, getDrizzleDb, hasDb } from "../../payment/__tests__/test-db";
import { addExtraMember, cleanupExtraMember, setupCommunityCtx } from "./__tests__/test-helpers";
import { CommunityService } from "./community.service";
import { CommunityPollService } from "./community-poll.service";

const describeIfDb = hasDb ? describe : describe.skip;
jest.setTimeout(30_000);

const SINGLE_CHOICE: PollData = {
  options: [
    { id: "a", text: "사과", voteCount: 0 },
    { id: "b", text: "바나나", voteCount: 0 },
    { id: "c", text: "포도", voteCount: 0 },
  ],
  multipleChoice: false,
};

describeIfDb("CommunityPollService", () => {
  let svc: CommunityPollService;
  let ctx: Awaited<ReturnType<typeof setupCommunityCtx>>["ctx"];
  let voter: string;
  let teardown: () => Promise<void>;
  const createdPosts: string[] = [];

  beforeAll(() => {
    const db = getDrizzleDb();
    svc = new CommunityPollService(db, new CommunityService(db));
  });

  beforeEach(async () => {
    const setup = await setupCommunityCtx("poll");
    ctx = setup.ctx;
    teardown = setup.teardown;
    voter = await addExtraMember("poll", ctx.communityId);
    createdPosts.length = 0;
  });

  afterEach(async () => {
    const db = getDrizzleDb();
    for (const id of createdPosts) {
      await db.delete(communityPollVotes).where(eq(communityPollVotes.postId, id));
      await db.delete(communityPosts).where(eq(communityPosts.id, id));
    }
    await cleanupExtraMember(voter);
    await teardown();
  });

  afterAll(async () => {
    await endTestDb();
  });

  async function createPoll(
    poll: PollData,
    overrides: Partial<typeof communityPosts.$inferInsert> = {},
  ): Promise<string> {
    const [post] = await getDrizzleDb()
      .insert(communityPosts)
      .values({
        communityId: ctx.communityId,
        authorId: ctx.ownerId,
        title: "poll post",
        type: "poll",
        status: "published",
        pollData: poll,
        ...overrides,
      })
      .returning({ id: communityPosts.id });
    createdPosts.push(post!.id);
    return post!.id;
  }

  it("casts a single-choice vote and reveals results to the voter", async () => {
    const postId = await createPoll(SINGLE_CHOICE);
    const view = await svc.castVote(postId, voter, ["a"]);

    expect(view.userVotedOptionIds).toEqual(["a"]);
    expect(view.resultsVisible).toBe(true);
    expect(view.totalVotes).toBe(1);
    expect(view.options.find((o) => o.id === "a")?.voteCount).toBe(1);

    // cache persisted to poll_data
    const [row] = await getDrizzleDb()
      .select({ pollData: communityPosts.pollData })
      .from(communityPosts)
      .where(eq(communityPosts.id, postId));
    expect(row?.pollData?.options.find((o) => o.id === "a")?.voteCount).toBe(1);
  });

  it("blocks a duplicate vote on a single-choice poll (AC#1)", async () => {
    const postId = await createPoll(SINGLE_CHOICE);
    await svc.castVote(postId, voter, ["a"]);
    await expect(svc.castVote(postId, voter, ["b"])).rejects.toBeInstanceOf(ConflictException);

    // still exactly one ballot
    const rows = await getDrizzleDb()
      .select()
      .from(communityPollVotes)
      .where(eq(communityPollVotes.postId, postId));
    expect(rows).toHaveLength(1);
  });

  it("allows multiple options on a multi-choice poll but blocks re-voting the same option", async () => {
    const postId = await createPoll({ ...SINGLE_CHOICE, multipleChoice: true });
    const view = await svc.castVote(postId, voter, ["a", "b"]);
    expect(view.userVotedOptionIds.sort()).toEqual(["a", "b"]);
    expect(view.totalVotes).toBe(2);

    await expect(svc.castVote(postId, voter, ["a"])).rejects.toBeInstanceOf(ConflictException);
  });

  it("removes a vote and decrements the cached count", async () => {
    const postId = await createPoll(SINGLE_CHOICE);
    await svc.castVote(postId, voter, ["a"]);
    const view = await svc.removeVote(postId, voter);

    expect(view.userVotedOptionIds).toEqual([]);
    const rows = await getDrizzleDb()
      .select()
      .from(communityPollVotes)
      .where(eq(communityPollVotes.postId, postId));
    expect(rows).toHaveLength(0);

    const [row] = await getDrizzleDb()
      .select({ pollData: communityPosts.pollData })
      .from(communityPosts)
      .where(eq(communityPosts.id, postId));
    expect(row?.pollData?.options.find((o) => o.id === "a")?.voteCount).toBe(0);
  });

  it("remove with no existing vote is a no-op", async () => {
    const postId = await createPoll(SINGLE_CHOICE);
    const view = await svc.removeVote(postId, voter);
    expect(view.userVotedOptionIds).toEqual([]);
  });

  it("rejects voting on a closed (expired) poll — 종료 consistency (AC#2)", async () => {
    const postId = await createPoll({
      ...SINGLE_CHOICE,
      expiresAt: "2000-01-01T00:00:00.000Z",
    });
    await expect(svc.castVote(postId, voter, ["a"])).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects voting on a locked post", async () => {
    const postId = await createPoll(SINGLE_CHOICE, { isLocked: true });
    await expect(svc.castVote(postId, voter, ["a"])).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("treats a hidden/deleted poll post as not found — 숨김/삭제 consistency (AC#2)", async () => {
    const hidden = await createPoll(SINGLE_CHOICE, { status: "hidden" });
    await expect(svc.getPoll(hidden, voter)).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.castVote(hidden, voter, ["a"])).rejects.toBeInstanceOf(NotFoundException);

    const deleted = await createPoll(SINGLE_CHOICE, { status: "deleted" });
    await expect(svc.castVote(deleted, voter, ["a"])).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects a banned member — 차단 consistency (AC#2)", async () => {
    const postId = await createPoll(SINGLE_CHOICE);
    await getDrizzleDb()
      .update(communityMemberships)
      .set({ isBanned: true })
      .where(eq(communityMemberships.userId, voter));
    await expect(svc.castVote(postId, voter, ["a"])).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects a non-member", async () => {
    const postId = await createPoll(SINGLE_CHOICE);
    const stranger = await addExtraMember("poll-stranger", ctx.communityId);
    await getDrizzleDb()
      .delete(communityMemberships)
      .where(eq(communityMemberships.userId, stranger));
    await expect(svc.castVote(postId, stranger, ["a"])).rejects.toBeInstanceOf(ForbiddenException);
    await cleanupExtraMember(stranger);
  });

  it("hides live results from a non-voter on an open poll (visibility policy)", async () => {
    const postId = await createPoll(SINGLE_CHOICE);
    await svc.castVote(postId, voter, ["a"]);

    // a different member who has NOT voted
    const peeker = await addExtraMember("poll-peek", ctx.communityId);
    const view = await svc.getPoll(postId, peeker);
    expect(view.resultsVisible).toBe(false);
    expect(view.totalVotes).toBeNull();
    expect(view.options.every((o) => o.voteCount === null)).toBe(true);
    await cleanupExtraMember(peeker);
  });

  it("rejects an unknown option id", async () => {
    const postId = await createPoll(SINGLE_CHOICE);
    await expect(svc.castVote(postId, voter, ["zzz"])).rejects.toThrow();
  });
});
