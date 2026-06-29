/**
 * E2E env / URL 공통 (apps/app).
 *
 * 모든 spec 이 같은 `APP_URL` / `appUrl(path)` 를 쓰도록 단일화.
 * docs/runbooks/e2e-management.md §1.3 — helper 위치 규약.
 */

export const APP_URL = process.env.E2E_APP_URL ?? "http://localhost:3000";

export function appUrl(path: string): string {
  return `${APP_URL}${path}`;
}
