# M-010 KCB Identity Verification REUSE Capability

## 1. Mission

Implement a reusable KCB/Ok-name identity verification capability in
product-builder-base without fabricating official KCB payloads.

## 2. Source Brief

`/Users/bright/Projects/product-builder-base/product-builder-kcb-identity-verification-reuse-feature.md`

## 3. Scope

- `packages/features/identity-verification/**`
- `packages/drizzle/src/schema/features/identity-verification/**`
- `apps/kcb-identity-server/**`
- `apps/admin/src/features/identity-verification/**`
- `tests/identity-verification/**`
- reference docs

## 4. Constraints

- Do not commit KCB JAR/license/native artifacts.
- Do not infer official request/response fields.
- Do not render raw provider error messages to users.
- Keep standard and custom modes separate.

## 5. Acceptance

- Java adapter service exists with health and internal endpoint boundary.
- REST API/OpenAPI decorators exist for KCB sessions, callback/return, admin
  list/detail/health/retry/archive.
- Drizzle schema includes sessions, results, events, consents, admin actions.
- Reusable UI exports protected gate and return panel.
- Admin route shows health blockers, session history, session detail, provider
  event timeline, masked result fields, consent versions, and retention state.
- Capability registry exports `identity-verification.kcb.*` IDs.
- Custom mode is explicitly blocked until official docs/fixtures exist.

## 6. Verification Log

- PASS `pnpm check:changed`
- PASS `pnpm --filter @flotter/features exec tsx --test identity-verification/__tests__/kcb-contract.spec.ts`
- PASS `pnpm --filter @flotter/drizzle check-types`
- PASS `pnpm --filter admin exec tsc --noEmit --pretty false`
- PASS `pnpm --filter server exec tsc --noEmit --pretty false`
- PASS `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/atlas pnpm api:codegen`
- PASS `pnpm --filter admin build`
- PASS `git diff --check`
- BLOCKED `apps/kcb-identity-server` Java unit tests: this machine has Java 17,
  but `mvn` and `gradle` are not installed.
- KNOWN BASELINE FAIL `pnpm --filter @flotter/features check-types`: existing
  spec errors in backup-googledrive, community, fenm-serving, payment, and story
  files; no new `identity-verification` file appears in the error list.

Live KCB smoke verification remains blocked until the official contract, test
account, site code, JAR, license/dat, native library, and result code table are
supplied.
