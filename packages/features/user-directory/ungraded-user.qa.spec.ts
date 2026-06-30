/**
 * QA regression guard — FR-001 사용자 (BBR-491).
 *
 * Locks the "등급 미부여(ungraded) user" state across the three directory tiers.
 *
 * Why this exists: the social-login signup hook in `packages/core/auth/
 * server.ts` (`databaseHooks.user.create.after`) does NOT call
 * `UserGradeService.ensureSignupGrade` (verified: no runtime caller). So every
 * freshly created user currently has no `user_grades` row. `mappers.spec`
 * already asserts `toPublicUser` degrades to `grade: null`, but the self and
 * admin tiers were unverified for the same row. This guard pins that the
 * ungraded state is a *graceful degradation* (grade=null, no throw) on all
 * tiers — not a crash — and that the missing grade never collapses the other
 * fields of each tier.
 *
 * If the signup→grade wiring is later connected, this case becomes only the
 * brief just-after-signup window; the assertions stay valid as a fail-safe.
 */
import { toAdminUser, toPublicUser, toSelfUser, type UserDirectoryRow } from "./mappers";

/** A profile row with NO resolved grade (every grade* column null). */
function ungradedRow(): UserDirectoryRow {
  return {
    profile: {
      id: "new-signup-1",
      name: "갓 가입한 사용자",
      email: "fresh@example.com",
      handle: "fresh",
      bio: null,
      avatar: null,
      authProvider: "kakao",
      isActive: true,
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
      updatedAt: new Date("2026-07-01T00:00:00.000Z"),
      marketingConsentAt: null,
      deletedAt: null,
    } as UserDirectoryRow["profile"],
    gradeId: null,
    gradeSlug: null,
    gradeName: null,
    gradeDailyUsageLimit: null,
    gradeSource: null,
    gradeDeterminedAt: null,
    gradeExpiresAt: null,
  };
}

describe("FR-001 ungraded user — graceful degradation across tiers", () => {
  it("public tier degrades to grade=null without throwing", () => {
    const row = ungradedRow();
    expect(() => toPublicUser(row)).not.toThrow();
    expect(toPublicUser(row).grade).toBeNull();
  });

  it("self tier keeps own private fields even when ungraded", () => {
    const result = toSelfUser(ungradedRow());
    expect(result.grade).toBeNull();
    // missing grade must not collapse the self-tier projection
    expect(result.email).toBe("fresh@example.com");
    expect(result.authProvider).toBe("kakao");
    expect(result.isActive).toBe(true);
  });

  it("admin tier keeps operational fields even when ungraded", () => {
    const result = toAdminUser(ungradedRow());
    expect(result.grade).toBeNull();
    // operator view still resolves; soft-delete bookkeeping intact
    expect(result.email).toBe("fresh@example.com");
    expect(result.deletedAt).toBeNull();
    expect(result.createdAt).toBe("2026-07-01T00:00:00.000Z");
  });
});
