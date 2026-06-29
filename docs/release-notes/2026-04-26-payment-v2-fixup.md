# Payment v2 Fixup — 2026-04-26

PR: #56 follow-up (`fix/payment-followups` → `feat/payment-v1`)

## What shipped

16 항목 정합 fix, 14 commits + 1 amendment + 1 release notes commit. Spec: `docs/superpowers/specs/2026-04-26-payment-v2-fixup-design.md`. Plan: `docs/superpowers/plans/2026-04-26-payment-v2-fixup.md`.

| # | 항목 | 우선 | Commit |
|---|---|---|---|
| Foundation | fixtures + docs index + raw header fixture | — | 3001b87c |
| B+C+L | dispatcher event names + zod schema + dispatcher arg fix | P0 | 8dde78af |
| (amend) | total_amount + incomplete→past_due + refund.amount.nonnegative | P0 | e3717a78 |
| M | payment_orders mirror upsert | P0 | 297da824 |
| N | refund top-level correlation | P0 | 8a19c84a |
| O | deferred webhook self-heal wiring | P0 | a7fe8d94 |
| P | webhook event catalog (active/uncanceled/revoked/past_due/order.updated/checkout.expired/benefit_grant.*) | P0 | b1d9078e |
| D | success_url Polar placeholder | P0 | dd19b74b |
| E | cancel_url type 제거 | P2 | e2e22b43 |
| F | metadata key 표준화 (string only) + topup credits parse | P2 | ae2fec2a |
| G | customer_external_id ↔ user.id + comment fix | P2 | 6714a0ea |
| I | discount_code 형식 verify | P2 | 0d8a322f |
| A+Q | webhook signature spec hardening + raw header fixture | P1 | 7531dd4e |
| J | webhook redeliver helper + runbook §1.4 | P1 | 48d2aec3 |
| H + release | idempotency-key verification + this release notes | P1 | (this commit) |

K (admin e2e auth race — useSession refetch) ships in separate PR `fix(auth): refetch useSession after sign-in`.

## Done criteria evidence

### Build & test

- **payment unit**: `Test Suites: 1 skipped, 22 passed, 22 of 23 total / Tests: 1 skipped, 1 todo, 168 passed, 170 total / Time: 106.256 s` (166 prior + 2 new H verification tests). Log: `/tmp/v2-fixup-evidence/payment-test.log`.
- **typecheck**: 168 errors (pre-existing baseline; 0 new from v2 fixup) — established in Task 7.
- **lint**: `153 problems (0 errors, 153 warnings)` — baseline preserved, delta 0. Log: `/tmp/v2-fixup-evidence/payment-lint.log`.
- **app build**: `✓ built in 12.85s` — 0 error. Log: `/tmp/v2-fixup-evidence/app-build.log`.
- **admin build**: `✓ built in 5.66s` — 0 error. Log: `/tmp/v2-fixup-evidence/admin-build.log`.

### Polar 정합

- 14 fixture snapshot tests PASS (Task 1+2: `polar.payload.schema.spec.ts`, `polar.webhook.dispatcher.spec.ts` covering checkout.updated/order.created/order.paid/order.refunded/subscription.created/.updated/.canceled/.active/.uncanceled/.revoked/.past_due/checkout.expired/benefit_grant.created/benefit_grant.cycled).
- exact-once replay: same `webhook-id` re-POST → ledger 1 row only (idempotent on `polar_event_id`; covered in `polar.webhook.dispatcher.spec.ts` exact-once test).
- deferred recovery: order.paid before subscription.created → cron fires → ledger granted (`DeferredEventLoggerService` Task 5; e2e currently `it.todo`, segment unit specs cover the loop).
- payment_orders 전이: order.paid (insert) → order.refunded (refundedAt updated) — `OrderMirrorService` Task 3.
- refund-without-metadata: top-level order_id correlation — Task 4.

### 실 결제 검증

- **sandbox Pro Monthly 1회 (2026-04-26)**: Polar checkout success captured (PR #56 prior session).
- **original failed webhooks**: 40 failed deliveries (status 401) discovered for redelivery via `redeliver-polar-webhooks.ts --dry-run --limit=50` against endpoint `fd272d73-70e7-4176-9398-a04d4123faca` — verified Task 13 + this task. Log: `/tmp/v2-fixup-evidence/redeliver-dryrun.log`.
- **Playwright e2e admin A1/A5/A6/A7**:
  - A7 (audit log page renders without 404): **PASS**.
  - A1/A5/A6: **FAIL** — admin server lacks seeded payment data in this worktree (no plans / no coupon button rendered). Pre-existing fixture gap; deferred to v1.1 with seeded subscription fixture per plan acknowledgment.
  - Log: `/tmp/v2-fixup-evidence/playwright-e2e.log`.

## Open follow-ups (v1.1)

- A1/A2/A3/A4/A5/A6 admin e2e (need seeded subscription + plan + coupon fixture; A7 already green).
- Top-up package mirroring in `OrderMirrorService` (Task 3 INV-7 deferred).
- past_due automated alert (currently runbook only).
- Polar production secret rotation drill.
- Live POST URL for redeliver script (untested; first operator run validates).
- TS cast in `parseSubscriptionEvent` widen `SubEvent.type` to include all subscribed events (Task 6 follow-up).

## Files most affected

- `packages/features/payment/webhooks/polar.webhook.dispatcher.ts` (+~150 lines net across tasks)
- `packages/features/payment/webhooks/polar.payload.schema.ts` (NEW, 76 lines)
- `packages/features/payment/service/order-mirror.service.ts` (NEW, ~95 lines)
- `packages/features/payment/service/deferred-event-logger.service.ts` (NEW, 38 lines)
- `packages/features/payment/__fixtures__/polar/` (14 fixture JSONs + helper + barrel)
- `packages/features/payment/service/polar.adapter.spec.ts` (+H verification tests, this commit)
- `apps/server/scripts/redeliver-polar-webhooks.ts` (NEW)
- `docs/runbooks/payment-ops.md` (§1.4 added)
- `docs/reference/polar-api-index.md` (NEW)
