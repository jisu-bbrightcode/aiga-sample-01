/**
 * 멤버/모더레이터 projection mappers 단위 테스트 (PB-COMM-MEMBER-API-001 / BBR-592).
 *
 * AC#1: 공개 view 는 운영 필드(ban/mute/알림 등)를 절대 노출하지 않는다(fail-closed).
 */
import type { CommunityMembership, CommunityModerator } from "@repo/drizzle/schema";
import {
  type OperationalMemberItem,
  toOperationalMemberItem,
  toOperationalModeratorItem,
  toPublicMemberItem,
  toPublicModeratorItem,
} from "./member-mappers";

const membershipRow = (over: Partial<CommunityMembership> = {}): CommunityMembership =>
  ({
    id: "m1",
    communityId: "c1",
    userId: "u1",
    role: "member",
    joinedAt: new Date("2026-01-01T00:00:00.000Z"),
    isBanned: false,
    bannedAt: null,
    bannedReason: null,
    bannedBy: null,
    banExpiresAt: null,
    isMuted: false,
    mutedUntil: null,
    notificationsEnabled: true,
    flairText: "OG",
    flairColor: "#fff",
    tier: "newcomer",
    onboardingCompletedAt: null,
    rulesAcceptedAt: null,
    ...over,
  }) as CommunityMembership;

const moderatorRow = (over: Partial<CommunityModerator> = {}): CommunityModerator =>
  ({
    id: "mod1",
    communityId: "c1",
    userId: "u9",
    permissions: {
      managePosts: true,
      manageComments: true,
      manageUsers: true,
      manageFlairs: false,
      manageRules: false,
      manageSettings: false,
      manageModerators: false,
      viewModLog: true,
      viewReports: true,
    },
    appointedBy: "owner1",
    appointedAt: new Date("2026-02-02T00:00:00.000Z"),
    ...over,
  }) as CommunityModerator;

describe("toPublicMemberItem", () => {
  it("exposes only public fields", () => {
    const item = toPublicMemberItem(membershipRow());
    expect(item).toEqual({
      userId: "u1",
      role: "member",
      tier: "newcomer",
      flairText: "OG",
      flairColor: "#fff",
      joinedAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("never leaks operational fields even for a banned member (fail-closed)", () => {
    const item = toPublicMemberItem(
      membershipRow({ isBanned: true, bannedReason: "spam", bannedBy: "mod1" }),
    ) as unknown as Record<string, unknown>;
    expect(item).not.toHaveProperty("isBanned");
    expect(item).not.toHaveProperty("bannedReason");
    expect(item).not.toHaveProperty("bannedBy");
    expect(item).not.toHaveProperty("isMuted");
    expect(item).not.toHaveProperty("notificationsEnabled");
    expect(item).not.toHaveProperty("id");
  });
});

describe("toOperationalMemberItem", () => {
  it("includes public + operational fields with ISO timestamps", () => {
    const item: OperationalMemberItem = toOperationalMemberItem(
      membershipRow({
        isBanned: true,
        bannedAt: new Date("2026-03-03T00:00:00.000Z"),
        bannedReason: "spam",
        bannedBy: "mod1",
      }),
    );
    expect(item.userId).toBe("u1");
    expect(item.isBanned).toBe(true);
    expect(item.bannedAt).toBe("2026-03-03T00:00:00.000Z");
    expect(item.bannedReason).toBe("spam");
    expect(item.bannedBy).toBe("mod1");
    expect(item.notificationsEnabled).toBe(true);
  });
});

describe("toPublicModeratorItem", () => {
  it("exposes only identity, never permissions or appointedBy", () => {
    const item = toPublicModeratorItem(moderatorRow()) as unknown as Record<string, unknown>;
    expect(item).toEqual({ userId: "u9", appointedAt: "2026-02-02T00:00:00.000Z" });
    expect(item).not.toHaveProperty("permissions");
    expect(item).not.toHaveProperty("appointedBy");
  });
});

describe("toOperationalModeratorItem", () => {
  it("includes permissions + appointedBy", () => {
    const item = toOperationalModeratorItem(moderatorRow());
    expect(item.userId).toBe("u9");
    expect(item.appointedBy).toBe("owner1");
    expect(item.permissions.managePosts).toBe(true);
  });
});
