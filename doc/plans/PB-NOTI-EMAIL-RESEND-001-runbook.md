# PB-NOTI-EMAIL-RESEND-001 — Email (Resend) provider 연결

Issue: **BBR-654** · Decision: `EXTEND` · Area: 서버/API · Capability: `notification.email.resend`
Base source: `product-builder-base@111d7721` (see [[PB-BASE-001]] registry)

## Decision summary (EXTEND, not NEW)

The Resend email capability already exists in the base and was vendored into this
delivery repo. The base already provides, and this delivery **reuses unchanged**:

| Concern | Location | Status |
|---|---|---|
| Resend adapter | `packages/features/email/providers/resend.provider.ts` | ✅ REUSE |
| Email send + logging | `packages/features/email/service/email.service.ts` | ✅ REUSE |
| Templates (verify / reset / changed / welcome / notification) | `packages/features/email/templates/` | ✅ REUSE |
| Better Auth email hooks (signup verify, reset, changed, magic-link, org invite) | `packages/core/auth/server.ts` + `packages/features/email/email.module.ts` (`onModuleInit`) | ✅ REUSE |
| Admin log API (`/api/admin/email/*`) | `packages/features/email/controller/email.controller.ts` | ✅ REUSE |
| Env (`EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM`) | `apps/server/src/config/env.ts` | ✅ REUSE |

### Implemented delta (this issue)

| Deliverable | Location | Status |
|---|---|---|
| Bounce/complaint + delivered/opened webhook | `packages/features/email/controller/resend-webhook.controller.ts` → `POST /api/webhooks/resend` | ✅ NEW |
| Webhook signature verify (Svix/Standard-Webhooks HMAC + replay window) | `packages/features/email/webhooks/resend-signature.ts` | ✅ NEW |
| Event → `email_logs` mapping (no status regression) | `packages/features/email/webhooks/resend-event-mapper.ts`, `EmailService.recordProviderEvent` | ✅ NEW |
| SPF/DKIM/DMARC domain check | `packages/features/email/service/domain-verification.service.ts` + `service/domain-records.ts` | ✅ NEW |
| Operator readiness script | `apps/server/src/scripts/check-email-domain.ts` | ✅ NEW |
| `RESEND_WEBHOOK_SECRET` env | `apps/server/src/config/env.ts`, `.env.example` | ✅ NEW |

## Acceptance criteria mapping

1. **Auth mails route through the EMAIL channel** — signup verification
   (`emailVerification.sendOnSignUp: true`), email confirmation, and password
   reset all flow Better Auth → injected senders → `EmailService` → Resend, with
   a row written to `email_logs`. ✅ (REUSE, verified by `email.module.spec.ts`).
2. **Email(Resend) is the default execution target** — `EMAIL_PROVIDER` defaults
   to `resend`; `requireEmailVerification` is on in production. ✅
3. **Resend API key/env + sending-domain auth status recorded on the issue** —
   ⛔ requires operator provisioning (see below). Code + verification tooling are
   in place; the live values cannot be produced without operator credentials.

## Operator runbook (unblocks AC #3)

Owner: **operator** (same credential gate as PB-INFRA-001). Steps:

1. **Create Resend API key** → set `RESEND_API_KEY=re_...` in Vercel project env
   (Production + Preview).
2. **Add sending domain** in Resend (e.g. `mail.<aiga-domain>`), publish the
   generated **SPF (TXT/MX), DKIM (TXT/CNAME), DMARC (TXT `_dmarc`)** DNS records.
3. **Verify domain auth** — run and paste the output into BBR-654 as evidence:
   ```bash
   RESEND_API_KEY=re_... pnpm tsx apps/server/src/scripts/check-email-domain.ts mail.<aiga-domain>
   ```
   Exit code 0 + "SPF/DKIM/DMARC all verified" is the pass gate.
4. **Set `EMAIL_FROM`** to a sender on the verified domain.
5. **Create the Resend webhook** → endpoint `https://<deploy-url>/api/webhooks/resend`,
   subscribe to `email.delivered`, `email.bounced`, `email.complained`,
   `email.opened`. Copy the signing secret to `RESEND_WEBHOOK_SECRET=whsec_...`.
   (Empty secret → endpoint returns 503 and events are rejected.)

## Notes / follow-ups

- The `email_status` enum has no dedicated `complained` value, so spam complaints
  are stored as the terminal `bounced` status with `failureReason = "spam
  complaint (email.complained)"` and `metadata.lastProviderEvent`. Adding a
  first-class `complained` enum value is an optional follow-up requiring a Drizzle
  migration (`ALTER TYPE email_status ADD VALUE 'complained'`).
- Webhook status updates never regress (an `opened` event will not overwrite a
  `bounced` row); precedence is encoded in `resolveStatusUpdate`.
- Pure logic (signature verify, event mapping, record classification) is covered
  by `*.spec.ts` and was validated with `node --test`. Full Nest/Drizzle
  integration verification requires `pnpm install` + a live Resend secret +
  deployed endpoint (operator environment).
