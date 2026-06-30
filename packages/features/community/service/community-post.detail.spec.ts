/**
 * CommunityPostService.findDetailForViewer — DB-free unit spec
 * (PB-COMM-POST-API-READ-001 / BBR-595).
 *
 * Proves the BBR-595 deltas without DATABASE_URL:
 *   AC#1 신고/숨김/차단/삭제 상태에 따라 상세 접근 결과가 일관된다
 *     - published → 전체 노출 + 조회수 증가
 *     - deleted/removed → tombstone(masked) 일관 노출, 조회수 미증가
 *     - hidden/draft → 작성자·모더레이터에게만 노출(그 외 null → 404)
 *     - 차단한 작성자의 글 → null(목록 제외와 일관)
 *   viewer state(사용자별 신고/차단/리액션) 조립
 *   AC#2 비로그인 공개 상세 — guest viewer state 는 fully fail-closed
 *
 * db 는 select 결과를 FIFO 큐로 돌려주는 경량 mock 으로 대체한다.
 */

import type { CommunityContentModerationService } from "./community-content-moderation.service";
import type { CommunityKeywordFilterService } from "./community-keyword-filter.service";
import { CommunityPostService } from "./community-post.service";
import type { CommunityService } from "./community.service";
import type { CommunityTierService } from "./community-tier.service";

type Row = Record<string, unknown>;

function makePost(overrides: Row = {}): Row {
  return {
    id: "post-1",
    communityId: "community-1",
    communitySlug: "kdrama",
    authorId: "author-1",
    title: "Hello",
    content: "Body",
    type: "text",
    linkUrl: null,
    linkPreview: null,
    mediaUrls: null,
    pollData: null,
    flairId: null,
    isNsfw: false,
    isSpoiler: false,
    isOc: false,
    contentRating: "general",
    status: "published",
    isPinned: false,
    isLocked: false,
    removalReason: null,
    removedBy: null,
    viewCount: 3,
    upvoteCount: 5,
    downvoteCount: 1,
    voteScore: 4,
    commentCount: 2,
    shareCount: 0,
    crosspostParentId: null,
    hotScore: 1.2,
    lastActivityAt: new Date("2026-01-04T00:00:00.000Z"),
    createdAt: new Date("2026-01-02T00:00:00.000Z"),
    updatedAt: new Date("2026-01-03T00:00:00.000Z"),
    ...overrides,
  };
}

const AUTHOR_ROW = { id: "author-1", name: "Jane", avatar: "https://cdn/a.png" };

function makeDb(selectResults: unknown[][]) {
  let cursor = 0;
  const update = jest.fn(() => ({
    set: jest.fn(() => ({ where: jest.fn().mockResolvedValue(undefined) })),
  }));
  const db = {
    select: jest.fn(() => {
      // biome-ignore lint/suspicious/noExplicitAny: minimal drizzle query stub
      const chain: any = {
        from: () => chain,
        where: () => chain,
        limit: () => Promise.resolve(selectResults[cursor++] ?? []),
      };
      return chain;
    }),
    update,
  };
  return { db, update };
}

function buildSvc(db: unknown, isModerator = false) {
  const communityService = { isModerator: jest.fn().mockResolvedValue(isModerator) };
  const svc = new CommunityPostService(
    db as never,
    communityService as unknown as CommunityService,
    {} as CommunityKeywordFilterService,
    {} as CommunityTierService,
    {} as CommunityContentModerationService,
    {} as never,
  );
  return { svc, communityService };
}

describe("CommunityPostService.findDetailForViewer (unit)", () => {
  it("returns null when the post does not exist", async () => {
    const { db } = makeDb([[]]);
    const { svc } = buildSvc(db);
    await expect(svc.findDetailForViewer("missing")).resolves.toBeNull();
  });

  it("guest sees a published post in full, viewCount is incremented, viewer is fail-closed", async () => {
    const { db, update } = makeDb([[makePost()], [AUTHOR_ROW]]);
    const { svc } = buildSvc(db);

    const detail = await svc.findDetailForViewer("post-1");

    expect(detail).not.toBeNull();
    expect(detail?.post.title).toBe("Hello");
    expect(detail?.author).toEqual({ id: "author-1", name: "Jane", avatar: "https://cdn/a.png" });
    expect(detail?.stats.commentCount).toBe(2);
    expect(detail?.viewer).toEqual({
      authenticated: false,
      isAuthor: false,
      hasReported: false,
      hasBlockedAuthor: false,
      canModerate: false,
      myVote: null,
    });
    expect(update).toHaveBeenCalledTimes(1); // viewCount bump
  });

  it("masks deleted posts as a tombstone and does NOT bump viewCount", async () => {
    const { db, update } = makeDb([[makePost({ status: "deleted" })], [AUTHOR_ROW]]);
    const { svc } = buildSvc(db);

    const detail = await svc.findDetailForViewer("post-1");

    expect(detail?.post.title).toBe("[삭제된 게시글]");
    expect(detail?.post.content).toBe("[삭제된 게시글]");
    expect(detail?.post.status).toBe("deleted");
    expect(update).not.toHaveBeenCalled();
  });

  it("masks operator-removed posts with the policy tombstone", async () => {
    const { db } = makeDb([[makePost({ status: "removed" })], [AUTHOR_ROW]]);
    const { svc } = buildSvc(db);

    const detail = await svc.findDetailForViewer("post-1");

    expect(detail?.post.title).toBe("[운영 정책에 의해 삭제됨]");
  });

  it("hides a hidden post from an anonymous viewer (404)", async () => {
    const { db } = makeDb([[makePost({ status: "hidden" })]]);
    const { svc } = buildSvc(db);
    await expect(svc.findDetailForViewer("post-1")).resolves.toBeNull();
  });

  it("reveals a hidden post to its author with isAuthor=true", async () => {
    const { db, update } = makeDb([
      [makePost({ status: "hidden" })],
      [AUTHOR_ROW],
      [], // report
      [], // block
      [], // vote
    ]);
    const { svc } = buildSvc(db);

    const detail = await svc.findDetailForViewer("post-1", { viewerId: "author-1" });

    expect(detail).not.toBeNull();
    expect(detail?.viewer.isAuthor).toBe(true);
    expect(detail?.viewer.authenticated).toBe(true);
    expect(update).not.toHaveBeenCalled(); // hidden is not counted as a view
  });

  it("reveals a hidden post to a moderator", async () => {
    const { db } = makeDb([[makePost({ status: "hidden" })], [AUTHOR_ROW], [], [], []]);
    const { svc, communityService } = buildSvc(db, true);

    const detail = await svc.findDetailForViewer("post-1", { viewerId: "mod-9" });

    expect(detail?.viewer.canModerate).toBe(true);
    expect(communityService.isModerator).toHaveBeenCalledWith("community-1", "mod-9");
  });

  it("returns null when the viewer has blocked the author (consistent with list exclusion)", async () => {
    const { db } = makeDb([[makePost()]]);
    const { svc } = buildSvc(db);

    const detail = await svc.findDetailForViewer("post-1", {
      viewerId: "viewer-2",
      blockedUserIds: ["author-1"],
    });

    expect(detail).toBeNull();
  });

  it("assembles per-user report/block/reaction state for a logged-in viewer", async () => {
    const { db, update } = makeDb([
      [makePost()], // post
      [AUTHOR_ROW], // author
      [{ id: "report-1" }], // hasReportedPost → true
      [], // hasBlockedAuthor → false
      [{ vote: -1 }], // myVote → down
    ]);
    const { svc } = buildSvc(db);

    const detail = await svc.findDetailForViewer("post-1", { viewerId: "viewer-2" });

    expect(detail?.viewer).toEqual({
      authenticated: true,
      isAuthor: false,
      hasReported: true,
      hasBlockedAuthor: false,
      canModerate: false,
      myVote: "down",
    });
    expect(update).toHaveBeenCalledTimes(1); // published view bump
  });

  it("maps a positive vote to 'up'", async () => {
    const { db } = makeDb([[makePost()], [AUTHOR_ROW], [], [], [{ vote: 1 }]]);
    const { svc } = buildSvc(db);

    const detail = await svc.findDetailForViewer("post-1", { viewerId: "viewer-2" });

    expect(detail?.viewer.myVote).toBe("up");
  });
});
