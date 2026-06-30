import {
  ADMIN_POST_VIEWER_STATE,
  type EnrichedCommunityPost,
  publicPostViewerState,
  toAdminPostListItem,
  toPublicPostListItem,
} from "./mappers";

const createdAt = new Date("2026-01-02T03:04:05.000Z");
const updatedAt = new Date("2026-01-03T03:04:05.000Z");
const lastActivityAt = new Date("2026-01-04T03:04:05.000Z");

function makeRow(overrides: Partial<EnrichedCommunityPost> = {}): EnrichedCommunityPost {
  return {
    id: "post-1",
    communityId: "community-1",
    communitySlug: "kdrama",
    authorId: "author-1",
    authorName: "Jane",
    authorAvatar: "https://cdn/a.png",
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
    removalReason: "auto-filter: badword",
    removedBy: "mod-1",
    viewCount: 3,
    upvoteCount: 5,
    downvoteCount: 1,
    voteScore: 4,
    commentCount: 2,
    shareCount: 0,
    crosspostParentId: null,
    hotScore: 12.5,
    lastActivityAt,
    createdAt,
    updatedAt,
    ...overrides,
  } as EnrichedCommunityPost;
}

describe("toPublicPostListItem", () => {
  it("omits moderation internals (removalReason, removedBy)", () => {
    const item = toPublicPostListItem(makeRow());
    expect(item).not.toHaveProperty("removalReason");
    expect(item).not.toHaveProperty("removedBy");
  });

  it("projects public fields and serialises dates to ISO strings", () => {
    const item = toPublicPostListItem(makeRow());
    expect(item.id).toBe("post-1");
    expect(item.communitySlug).toBe("kdrama");
    expect(item.authorName).toBe("Jane");
    expect(item.createdAt).toBe(createdAt.toISOString());
    expect(item.updatedAt).toBe(updatedAt.toISOString());
    expect(item.lastActivityAt).toBe(lastActivityAt.toISOString());
  });

  it("defaults enrich fields to null when absent (fail-closed)", () => {
    const row = makeRow({
      authorName: undefined,
      authorAvatar: undefined,
      communitySlug: undefined,
    });
    const item = toPublicPostListItem(row);
    expect(item.authorName).toBeNull();
    expect(item.authorAvatar).toBeNull();
    expect(item.communitySlug).toBeNull();
  });

  it("never leaks an unknown future column from the row", () => {
    const row = makeRow() as EnrichedCommunityPost & { secretInternal: string };
    row.secretInternal = "leak";
    const item = toPublicPostListItem(row) as unknown as Record<string, unknown>;
    expect(item.secretInternal).toBeUndefined();
  });
});

describe("toAdminPostListItem", () => {
  it("includes the public projection plus moderation internals", () => {
    const item = toAdminPostListItem(makeRow());
    expect(item.id).toBe("post-1");
    expect(item.removalReason).toBe("auto-filter: badword");
    expect(item.removedBy).toBe("mod-1");
  });
});

describe("viewer state", () => {
  it("public viewer is never admin and reflects auth flag", () => {
    expect(publicPostViewerState(false)).toEqual({ authenticated: false, isAdmin: false });
    expect(publicPostViewerState(true)).toEqual({ authenticated: true, isAdmin: false });
  });

  it("admin viewer state is authenticated + admin", () => {
    expect(ADMIN_POST_VIEWER_STATE).toEqual({ authenticated: true, isAdmin: true });
  });
});
