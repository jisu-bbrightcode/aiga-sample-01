/**
 * Pure unit tests for the unified moderation-queue projection
 * (PB-COMM-MODERATION-API-LIST-001). No database — proves normalization,
 * cross-source state derivation, merge ordering, and page slicing.
 */
import {
  type BanRowInput,
  deriveBanActive,
  deriveFilterState,
  deriveReportState,
  type FilterRowInput,
  type ModerationQueueItem,
  normalizeBan,
  normalizeFilter,
  normalizeReport,
  paginateSlice,
  type ReportRowInput,
  sortByCreatedAtDesc,
} from "./moderation-queue";

const NOW = new Date("2026-07-01T00:00:00.000Z");

function reportRow(over: Partial<ReportRowInput> = {}): ReportRowInput {
  return {
    id: "r1",
    communityId: "c1",
    reporterId: "reporter-1",
    targetType: "post",
    targetId: "post-1",
    status: "pending",
    severity: "high",
    description: "스팸 신고",
    createdAt: new Date("2026-06-30T10:00:00.000Z"),
    ...over,
  };
}

function filterRow(over: Partial<FilterRowInput> = {}): FilterRowInput {
  return {
    id: "f1",
    communityId: "c1",
    authorId: "author-1",
    targetType: "comment",
    targetId: "comment-1",
    reviewStatus: "pending",
    ruleType: "keyword",
    action: "hidden_for_review",
    reason: "금지어: badword",
    createdAt: new Date("2026-06-30T11:00:00.000Z"),
    ...over,
  };
}

function banRow(over: Partial<BanRowInput> = {}): BanRowInput {
  return {
    id: "b1",
    communityId: "c1",
    userId: "user-1",
    bannedBy: "mod-1",
    reason: "반복 위반",
    isPermanent: true,
    expiresAt: null,
    createdAt: new Date("2026-06-30T12:00:00.000Z"),
    ...over,
  };
}

describe("moderation-queue state derivation", () => {
  it("maps report statuses to open/resolved", () => {
    expect(deriveReportState("pending")).toBe("open");
    expect(deriveReportState("reviewing")).toBe("open");
    expect(deriveReportState("resolved")).toBe("resolved");
    expect(deriveReportState("dismissed")).toBe("resolved");
  });

  it("maps filter review status to open/resolved", () => {
    expect(deriveFilterState("pending")).toBe("open");
    expect(deriveFilterState("approved")).toBe("resolved");
    expect(deriveFilterState("rejected")).toBe("resolved");
  });

  it("treats permanent or future/absent-expiry bans as active", () => {
    expect(deriveBanActive({ isPermanent: true, expiresAt: null }, NOW)).toBe(true);
    expect(deriveBanActive({ isPermanent: false, expiresAt: null }, NOW)).toBe(true);
    expect(
      deriveBanActive({ isPermanent: false, expiresAt: new Date("2026-07-02T00:00:00Z") }, NOW),
    ).toBe(true);
  });

  it("treats past-expiry temporary bans as expired", () => {
    expect(
      deriveBanActive({ isPermanent: false, expiresAt: new Date("2026-06-01T00:00:00Z") }, NOW),
    ).toBe(false);
  });
});

describe("moderation-queue normalization", () => {
  it("normalizes a report row with reporter as subject and raw status preserved", () => {
    const item = normalizeReport(reportRow({ status: "reviewing" }));
    expect(item).toMatchObject({
      kind: "report",
      subjectId: "reporter-1",
      state: "open",
      status: "reviewing",
      severity: "high",
      reason: "스팸 신고",
      ruleType: null,
      action: null,
    });
    expect(item.createdAt).toBe("2026-06-30T10:00:00.000Z");
  });

  it("normalizes a filter row carrying ruleType/action and author as subject", () => {
    const item = normalizeFilter(filterRow({ reviewStatus: "approved" }));
    expect(item).toMatchObject({
      kind: "filter",
      subjectId: "author-1",
      state: "resolved",
      status: "approved",
      ruleType: "keyword",
      action: "hidden_for_review",
      severity: null,
    });
  });

  it("normalizes a ban row to a user target with banned-by as subject", () => {
    const active = normalizeBan(banRow(), NOW);
    expect(active).toMatchObject({
      kind: "ban",
      targetType: "user",
      targetId: "user-1",
      subjectId: "mod-1",
      state: "open",
      status: "active",
    });

    const expired = normalizeBan(
      banRow({ isPermanent: false, expiresAt: new Date("2026-06-01T00:00:00Z") }),
      NOW,
    );
    expect(expired.state).toBe("resolved");
    expect(expired.status).toBe("expired");
  });
});

describe("moderation-queue merge + pagination", () => {
  const items: ModerationQueueItem[] = [
    normalizeReport(reportRow({ id: "r1", createdAt: new Date("2026-06-30T10:00:00Z") })),
    normalizeFilter(filterRow({ id: "f1", createdAt: new Date("2026-06-30T11:00:00Z") })),
    normalizeBan(banRow({ id: "b1", createdAt: new Date("2026-06-30T12:00:00Z") }), NOW),
  ];

  it("sorts newest-first across heterogeneous sources without mutating input", () => {
    const original = [...items];
    const sorted = sortByCreatedAtDesc(items);
    expect(sorted.map((i) => i.id)).toEqual(["b1", "f1", "r1"]);
    expect(items).toEqual(original); // immutability
  });

  it("breaks createdAt ties deterministically by id (desc)", () => {
    const ts = new Date("2026-06-30T10:00:00Z");
    const tied = sortByCreatedAtDesc([
      normalizeReport(reportRow({ id: "a", createdAt: ts })),
      normalizeReport(reportRow({ id: "c", createdAt: ts })),
      normalizeReport(reportRow({ id: "b", createdAt: ts })),
    ]);
    expect(tied.map((i) => i.id)).toEqual(["c", "b", "a"]);
  });

  it("slices the requested page window from the merged list", () => {
    const sorted = sortByCreatedAtDesc(items);
    expect(paginateSlice(sorted, 1, 2).map((i) => i.id)).toEqual(["b1", "f1"]);
    expect(paginateSlice(sorted, 2, 2).map((i) => i.id)).toEqual(["r1"]);
    expect(paginateSlice(sorted, 3, 2)).toEqual([]);
  });
});
