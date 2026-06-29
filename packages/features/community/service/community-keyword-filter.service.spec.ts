import { communities } from "@repo/drizzle";
import { eq } from "drizzle-orm";
import { endTestDb, getDrizzleDb, hasDb } from "../../payment/__tests__/test-db";
import { setupCommunityCtx } from "./__tests__/test-helpers";
import { CommunityKeywordFilterService } from "./community-keyword-filter.service";

const describeIfDb = hasDb ? describe : describe.skip;
jest.setTimeout(30_000);

describeIfDb("CommunityKeywordFilterService", () => {
  let svc: CommunityKeywordFilterService;

  beforeAll(() => {
    svc = new CommunityKeywordFilterService(getDrizzleDb());
  });

  afterAll(async () => {
    await endTestDb();
  });

  // ── checkContent (pure, no DB) ────────────────────────────────────
  it("checkContent() returns allow when bannedWords is empty", () => {
    expect(svc.checkContent(["any text"], [])).toEqual({
      passed: true,
      matchedWords: [],
      action: "allow",
    });
  });

  it("checkContent() matches whole words, case-insensitive", () => {
    const r = svc.checkContent(["Hello Spam world", "more SPAMMING"], ["spam"]);
    // word boundary: SPAMMING is NOT matched (no boundary after SPAM).
    expect(r.matchedWords).toEqual(["spam"]);
    expect(r.action).toBe("review");
    expect(r.passed).toBe(false);
  });

  it("checkContent() escapes regex metachars in banned words", () => {
    const r = svc.checkContent(["abc.def", "abcXdef"], ["abc.def"]);
    expect(r.matchedWords).toContain("abc.def");
  });

  // ── validateContent (with DB) ─────────────────────────────────────
  it("validateContent() bypasses everything when bypassFilter=true", async () => {
    const { ctx, teardown } = await setupCommunityCtx("kwf-bypass");
    try {
      await getDrizzleDb()
        .update(communities)
        .set({
          bannedWords: ["forbidden"],
          automodConfig: { enableKeywordFilter: true } as never,
        })
        .where(eq(communities.id, ctx.communityId));
      const r = await svc.validateContent(ctx.communityId, ["this has forbidden"], {
        bypassFilter: true,
      });
      expect(r).toEqual({ passed: true, matchedWords: [], action: "allow" });
    } finally {
      await teardown();
    }
  });

  it("validateContent() returns allow when enableKeywordFilter is false", async () => {
    const { ctx, teardown } = await setupCommunityCtx("kwf-disabled");
    try {
      await getDrizzleDb()
        .update(communities)
        .set({
          bannedWords: ["forbidden"],
          automodConfig: { enableKeywordFilter: false } as never,
        })
        .where(eq(communities.id, ctx.communityId));
      const r = await svc.validateContent(ctx.communityId, ["this has forbidden"]);
      expect(r.action).toBe("allow");
      expect(r.passed).toBe(true);
    } finally {
      await teardown();
    }
  });

  it("validateContent() returns allow when bannedWords is empty", async () => {
    const { ctx, teardown } = await setupCommunityCtx("kwf-empty");
    try {
      await getDrizzleDb()
        .update(communities)
        .set({ bannedWords: [], automodConfig: { enableKeywordFilter: true } as never })
        .where(eq(communities.id, ctx.communityId));
      const r = await svc.validateContent(ctx.communityId, ["forbidden"]);
      expect(r.action).toBe("allow");
    } finally {
      await teardown();
    }
  });

  it("validateContent() applies the configured action when keywords match", async () => {
    const { ctx, teardown } = await setupCommunityCtx("kwf-block");
    try {
      await getDrizzleDb()
        .update(communities)
        .set({
          bannedWords: ["badword"],
          automodConfig: {
            enableKeywordFilter: true,
            keywordFilterAction: "block",
          } as never,
        })
        .where(eq(communities.id, ctx.communityId));
      const r = await svc.validateContent(ctx.communityId, ["this is badword stuff"]);
      expect(r.passed).toBe(false);
      expect(r.action).toBe("block");
      expect(r.matchedWords).toEqual(["badword"]);
    } finally {
      await teardown();
    }
  });

  it("validateContent() returns allow for an unknown communityId", async () => {
    const r = await svc.validateContent("00000000-0000-0000-0000-000000000000", ["forbidden"]);
    expect(r.action).toBe("allow");
  });
});
