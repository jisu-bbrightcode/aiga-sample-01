# 이메일 알림 검증 (PB-NOTI-EMAIL-QA-001 / BBR-663)

QA Engineer regression report for the customer email-notification capability
(`notification.email.qa`). EXTEND of the base 이메일 알림 QA checklist — this
document is the reusable checklist plus the verified evidence for this build.

- **Build**: `bp-0b891299-66b7-438f-a3a4-7a63fbf8632b` (online-service-standard)
- **Verified against**: `origin/main` @ `b710760` (clean worktree, not the dirty
  feature branch the session was checked out on)
- **Depends on**: PB-NOTI-EMAIL-ADMIN-001 (admin template UI — PR #102, still
  open). Backend capability under test is fully merged to `main`.

## How to reproduce

```bash
# jest (mocked Drizzle — no DB required) — full email feature suite
cd packages/features
NODE_OPTIONS=--experimental-vm-modules jest --testPathPatterns 'email/'

# node:test — auth-side senders + seed catalog (signup / verify / password reset)
pnpm --filter @repo/... run test:auth:core    # from repo root, or:
tsx --test packages/core/auth/email-verification-sender.test.ts \
           packages/core/auth/password-reset-sender.test.ts \
           packages/core/auth/password-reset-url.test.ts \
           packages/core/auth/password-changed-sender.test.ts \
           packages/drizzle/src/seed/email-templates.catalog.test.ts
```

## Result summary

| Suite | Tests | Status |
|-------|------:|--------|
| `packages/features/email/**` (jest) | 109 | ✅ pass (18 suites) |
| `packages/core/auth` senders + seed catalog (node:test) | 18 | ✅ pass |
| **Total** | **127** | ✅ |

109 includes the **8 new regression tests** added by this QA item
(`email/service/email-resend-retry.spec.ts`) closing the resend/retry +
provider-event-reconciliation coverage gap (see Gap closed below).

## Scope → evidence map

| Scope item | Surface | Evidence |
|------------|---------|----------|
| **회원가입 / 인증** | `email-verification.tsx`, `welcome.tsx`, `auth/email-verification-sender` | `email-verification-sender.test.ts` (delegation + prod-missing-sender guard); seed keys `auth.welcome`, `auth.email-verification` validated by catalog test |
| **비밀번호 재설정** | `password-reset.tsx`, `password-changed.tsx`, `auth/password-reset-sender`, `password-reset-url` | `password-reset-sender.test.ts`, `password-reset-url.test.ts` (frontend URL from Better Auth callback / APP_URL fallback), `password-changed-sender.test.ts`; seed keys `password.password-reset`, `password.password-changed` |
| **테스트 발송** | `POST /admin/email/templates/:key/test-send`, `EmailService.sendTestEmail` | `email-test-send.spec.ts` (sample-variable synthesis, rate limit, failed log returned not thrown), `email-send-by-key.spec.ts` |
| **실패 / 재시도** | `POST /admin/email/logs/:logId/resend` (`resendEmail`), provider failure path in `sendEmail` | **NEW** `email-resend-retry.spec.ts`: re-dispatch marks sent + `retryCount++`; provider error records `status=failed` + `failureReason` + `retryCount++` and rethrows; not-found → 404 |
| **발송 이력** | `GET /admin/email/logs`, `GET /admin/email/logs/:logId`, `email_logs` table, Resend webhook reconciliation (`recordProviderEvent`) | `email.controller.spec.ts` (log listing/detail wiring), `resend-event-mapper.spec.ts` + `resend-signature.spec.ts` (parse + HMAC verify), **NEW** `email-resend-retry.spec.ts` reconciliation: delivered→`deliveredAt`, bounce→terminal+reason, **no-regression** (opened never downgrades bounced), unmatched/ignored events → `matched:false` |
| **관리자 CRUD 회귀** | `POST/GET/PATCH /admin/email/templates`, `/publish`, `/validate`, `/preview` | `email-template-create.spec.ts`, `email-template-update.spec.ts`, `email-template-publish.spec.ts`, `email-template-registry.service.spec.ts`, `variable-schema.spec.ts`, `string-renderer.spec.ts`. Admin-only access enforced by `BetterAuthGuard + BetterAuthAdminGuard` (`email.controller.spec.ts`) |
| **멱등 발송** | `idempotencyKey` partial-unique index (migration `0056`) | `email-send-idempotency.spec.ts` |
| **도메인 발신 검증** | `domain-verification.service`, `domain-records` | `domain-records.spec.ts` |

## Data model / migrations

- `0052_email_template_versions.sql` — templates + versioned registry (rollback target).
- `0056_email_send_idempotency.sql` — partial-unique `idempotencyKey` index.
- `email_logs` carries `status`, `providerMessageId`, `failureReason`,
  `retryCount`, `deliveredAt`/`openedAt`, `templateKey`/`templateVersionId`.

## Gap closed by this QA item

`EmailService.resendEmail` (admin 재발송) and `EmailService.recordProviderEvent`
(webhook → 발송 이력 status sync) were exercised only indirectly through
controller/webhook wiring — no direct service-level assertions on the retry
counter, failure-reason capture, or the no-regression status precedence. Added
`email/service/email-resend-retry.spec.ts` (8 tests) so these two acceptance
deliverables are pinned at the service boundary.

## Acceptance criteria status

- **AC1 — 필수 이메일 flow가 실제 provider 또는 sandbox에서 발송까지 검증된다**:
  ⚠️ **Partially blocked on infra-owned secrets.** The dispatch path
  (render → provider.send → log status `sent`/`failed` → webhook reconcile) is
  verified through the mocked provider. A *live* Resend send additionally requires
  operator-owned configuration that is **not present in the QA environment**:
  - `RESEND_API_KEY` (`ResendProvider` throws `RESEND_API_KEY environment
    variable is required` without it — there is no sandbox/dry-run fallback),
  - `EMAIL_FROM` on a Resend-verified sending domain (`domain-verification.service`),
  - `RESEND_WEBHOOK_SECRET` for delivery/bounce reconciliation (controller returns
    `503 webhook_not_configured` when unset).

  See **Live send runbook** below; this is the same shape of infra gate noted in
  PB-FILE-QA-001 (Vercel Blob env).
- **AC2 — CRUD/API/UI/발송 로그 증거가 issue에 남는다**: ✅ Backend CRUD/API and
  send-log behaviour verified (127 tests, evidence above). Admin **UI** evidence
  is owned by PB-NOTI-EMAIL-ADMIN-001 (PR #102) and lands when that PR merges.

## Live send runbook (for the deploy/infra owner)

1. Set `RESEND_API_KEY`, `EMAIL_FROM` (verified domain), `RESEND_WEBHOOK_SECRET`
   in the Vercel/Neon deployment env.
2. Trigger each required flow against the deployed URL and capture evidence:
   - 회원가입 → 인증 메일, 비밀번호 재설정 메일 (auth flows),
   - `POST /admin/email/templates/:key/test-send` (operator test send),
   - confirm rows land in `GET /admin/email/logs` with `status` transitioning
     `pending → sent → delivered` (and `bounced`/`failed` on a bad recipient).
3. Point Resend webhooks at `POST /api/webhooks/resend`; confirm delivered/bounced
   events reconcile the log status.

## Residual risks

- Live provider/sandbox send not exercised here (infra secrets — see runbook).
- Service specs mock Drizzle; they assert behaviour/contracts, not real SQL
  constraints (the partial-unique idempotency index is covered by migration only).
- Admin UI QA pending PR #102 merge.
