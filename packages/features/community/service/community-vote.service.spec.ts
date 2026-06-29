/**
 * CommunityVoteService — upvote / downvote + score cache on posts / comments.
 *
 * Voting mutates two things:
 *   1. `community_votes` (the vote row)
 *   2. `community_posts.voteScore / upvoteCount / downvoteCount` (or comment counterparts)
 * The spec asserts both sides for post + comment targets.
 */

import { communityComments, communityPosts, communityVotes, userKarma } from "@repo/drizzle";
import { eq, inArray } from "drizzle-orm";
import { endTestDb, getDrizzleDb, hasDb } from "../../payment/__tests__/test-db";
import { addExtraMember, cleanupExtraMember, setupCommunityCtx } from "./__tests__/test-helpers";
import { CommunityVoteService } from "./community-vote.service";

const describeIfDb = hasDb ? describe : describe.skip;
jest.setTimeout(30_000);

describeIfDb("CommunityVoteService", () => {
  let svc: CommunityVoteService;
  let ctx: Awaited<ReturnType<typeof setupCommunityCtx>>["ctx"];
  let voter: string;
  let postId: string;
  let commentId: string;
  let teardown: () => Promise<void>;
  const extraUsers: string[] = [];

  beforeAll(() => {
    svc = new CommunityVoteService(getDrizzleDb());
  });

  beforeEach(async () => {
    const setup = await setupCommunityCtx("vote");
    ctx = setup.ctx;
    teardown = setup.teardown;
    voter = await addExtraMember("vote", ctx.communityId);
    extraUsers.length = 0;
    extraUsers.push(voter);

    const db = getDrizzleDb();
    const [post] = await db
      .insert(communityPosts)
      .values({
        communityId: ctx.communityId,
        authorId: ctx.ownerId,
        title: "vote target",
      })
      .returning({ id: communityPosts.id });
    postId = post!.id;

    const [comment] = await db
      .insert(communityComments)
      .values({
        postId,
        authorId: ctx.ownerId,
        content: "comment",
      })
      .returning({ id: communityComments.id });
    commentId = comment!.id;
  });

  afterEach(async () => {
    const db = getDrizzleDb();
    await db.delete(communityVotes).where(eq(communityVotes.userId, voter));
    await db.delete(communityComments).where(eq(communityComments.id, commentId));
    await db.delete(communityPosts).where(eq(communityPosts.id, postId));
    await db.delete(userKarma).where(inArray(userKarma.userId, [ctx.ownerId, ...extraUsers]));
    await cleanupExtraMember(voter);
    await teardown();
  });

  afterAll(async () => {
    await endTestDb();
  });

  async function getPostScore() {
    const [row] = await getDrizzleDb()
      .select({
        voteScore: communityPosts.voteScore,
        up: communityPosts.upvoteCount,
        down: communityPosts.downvoteCount,
      })
      .from(communityPosts)
      .where(eq(communityPosts.id, postId));
    return row!;
  }

  it("vote() upvote on a post returns updated score + cache", async () => {
    const r = await svc.vote({ targetType: "post", targetId: postId, vote: 1 }, voter);
    expect(r.voteScore).toBe(1);
    expect(r.upvoteCount).toBe(1);
    expect(r.downvoteCount).toBe(0);
    expect(r.userVote).toBe(1);
    const cached = await getPostScore();
    expect(cached.voteScore).toBe(1);
    expect(cached.up).toBe(1);
  });

  it("vote() flipping from upvote to downvote adjusts both counters", async () => {
    await svc.vote({ targetType: "post", targetId: postId, vote: 1 }, voter);
    const r = await svc.vote({ targetType: "post", targetId: postId, vote: -1 }, voter);
    expect(r.upvoteCount).toBe(0);
    expect(r.downvoteCount).toBe(1);
    expect(r.voteScore).toBe(-1);
    expect(r.userVote).toBe(-1);
  });

  it("vote() repeating the same vote is idempotent", async () => {
    await svc.vote({ targetType: "post", targetId: postId, vote: 1 }, voter);
    const r = await svc.vote({ targetType: "post", targetId: postId, vote: 1 }, voter);
    expect(r.upvoteCount).toBe(1); // not 2
  });

  it("removeVote() reverses a previous vote", async () => {
    await svc.vote({ targetType: "post", targetId: postId, vote: 1 }, voter);
    const r = await svc.removeVote({ targetType: "post", targetId: postId }, voter);
    expect(r.voteScore).toBe(0);
    expect(r.upvoteCount).toBe(0);
    expect(r.userVote).toBeNull();
  });

  it("removeVote() on no existing vote is a no-op (returns current state)", async () => {
    const r = await svc.removeVote({ targetType: "post", targetId: postId }, voter);
    expect(r.voteScore).toBe(0);
    expect(r.userVote).toBeNull();
  });

  it("vote() on a comment updates comment counters too", async () => {
    const r = await svc.vote({ targetType: "comment", targetId: commentId, vote: 1 }, voter);
    expect(r.upvoteCount).toBe(1);
    expect(r.voteScore).toBe(1);
    const [row] = await getDrizzleDb()
      .select({
        voteScore: communityComments.voteScore,
        up: communityComments.upvoteCount,
      })
      .from(communityComments)
      .where(eq(communityComments.id, commentId));
    expect(row?.voteScore).toBe(1);
    expect(row?.up).toBe(1);
  });
});
