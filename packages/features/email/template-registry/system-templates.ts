/**
 * Protected "system" email template keys
 * (PB-NOTI-EMAIL-API-DELETE-001 / BBR-660).
 *
 * These are the seeded, code-bound templates the platform's auth / transactional
 * flows depend on (가입 환영, 이메일 인증, 비밀번호 재설정/변경, 일반 알림). The
 * delete/archive endpoint must refuse to touch them — archiving or deleting one
 * would break a live send path that auth and other features call directly.
 *
 * Kept in sync with the seed catalog
 * (`packages/drizzle/src/seed/email-templates.catalog.ts`). It is not imported
 * here to avoid coupling the feature to the seed runner; `system-templates.spec.ts`
 * pins the expected key set so drift is caught in CI. Pure data — no DB I/O.
 */

export const SYSTEM_TEMPLATE_KEYS: readonly string[] = [
  "auth.welcome",
  "auth.email-verification",
  "password.password-reset",
  "password.password-changed",
  "transactional.notification",
];

const SYSTEM_TEMPLATE_KEY_SET = new Set(SYSTEM_TEMPLATE_KEYS);

/** True when a template key is a protected system template (must not be archived/deleted). */
export function isSystemTemplateKey(key: string): boolean {
  return SYSTEM_TEMPLATE_KEY_SET.has(key);
}
