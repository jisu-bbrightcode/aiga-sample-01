/**
 * 등급별 일일 사용 한도 표시 helper (FR-001 / BBR-581).
 *
 * The membership card shows the daily usage cap attached to the user's grade.
 * The server's self contract (`/users/me`) currently omits the numeric cap
 * (quota config is admin-only), so `dailyUsageLimit` arrives as `undefined`.
 * This pure resolver folds the three meaningful states into one discriminated
 * value the component renders without branching inline:
 *
 *  - `unknown`   — field absent from the contract → show the generic 한도 안내 copy.
 *  - `unlimited` — `null` → 무제한.
 *  - `limited`   — a non-negative number → 하루 N회.
 *
 * Keeping it pure makes every state unit-testable without a DOM.
 */

export type DailyLimitDisplay =
  | { kind: "unknown" }
  | { kind: "unlimited" }
  | { kind: "limited"; limit: number };

export function resolveDailyLimit(limit: number | null | undefined): DailyLimitDisplay {
  if (limit === undefined) return { kind: "unknown" };
  if (limit === null) return { kind: "unlimited" };
  // A negative/NaN cap is not a meaningful number to show — degrade to unknown.
  if (!Number.isFinite(limit) || limit < 0) return { kind: "unknown" };
  return { kind: "limited", limit };
}
