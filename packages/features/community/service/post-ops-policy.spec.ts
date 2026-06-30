/**
 * post-ops-policy 순수 함수 단위 테스트 (DB-free).
 * PB-COMM-POST-OPS-API-001 / BBR-603.
 */

import {
  buildPostOpAuditDetails,
  type PostModerationSnapshot,
  resolveToggleState,
  snapshotPostModeration,
} from "./post-ops-policy";

describe("resolveToggleState", () => {
  it("flips the current value when no explicit desired state is given", () => {
    expect(resolveToggleState(false)).toBe(true);
    expect(resolveToggleState(true)).toBe(false);
  });

  it("honors an explicit desired state idempotently", () => {
    expect(resolveToggleState(false, true)).toBe(true);
    expect(resolveToggleState(true, true)).toBe(true);
    expect(resolveToggleState(true, false)).toBe(false);
    expect(resolveToggleState(false, false)).toBe(false);
  });
});

describe("snapshotPostModeration", () => {
  it("keeps only moderation-relevant fields", () => {
    const snap = snapshotPostModeration({
      status: "published",
      isPinned: true,
      isLocked: false,
      // extra fields must not leak into the snapshot
      ...({ title: "secret", authorId: "u1" } as Record<string, unknown>),
    } as never);

    expect(snap).toEqual({ status: "published", isPinned: true, isLocked: false });
  });
});

describe("buildPostOpAuditDetails", () => {
  const before: PostModerationSnapshot = { status: "published", isPinned: false, isLocked: false };

  it("captures before/after state under a kind discriminator (AC#2)", () => {
    const after: PostModerationSnapshot = { status: "published", isPinned: true, isLocked: false };
    expect(buildPostOpAuditDetails("pin", before, after)).toEqual({
      kind: "pin",
      before,
      after,
    });
  });

  it("merges action-specific extra metadata (e.g. crosspost source/target)", () => {
    const after: PostModerationSnapshot = { status: "published", isPinned: false, isLocked: false };
    expect(
      buildPostOpAuditDetails("crosspost", before, after, {
        sourcePostId: "p1",
        sourceCommunityId: "c1",
        crosspostId: "p2",
      }),
    ).toEqual({
      kind: "crosspost",
      before,
      after,
      sourcePostId: "p1",
      sourceCommunityId: "c1",
      crosspostId: "p2",
    });
  });
});
