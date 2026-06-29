# Polar API Reference Index (sandbox 2026-04-26)

> **참고:** 이 파일은 Polar API 엔드포인트 인덱스입니다. 결제 도메인 전체 문서는
> [docs/features/payment/README.md](../features/payment/README.md) 를 참조하세요.
> Webhook 이벤트 상세: [docs/features/payment/webhook-events.md](../features/payment/webhook-events.md)

This file is a curated index of Polar API pages used by our payment feature.
Source-of-truth precedence (per spec §4.1):

| Domain | Precedence |
|---|---|
| incoming webhook field 변형 | observed payload > SDK type > docs |
| accepted request fields + event catalog | docs/OpenAPI > sandbox sample |

## Endpoints (request body / accepted fields)

- POST /v1/checkouts/ — <https://docs.polar.sh/api-reference/checkouts/create-session>
- PATCH /v1/subscriptions/{id} — <https://docs.polar.sh/api-reference/subscriptions/update>
- POST /v1/refunds/ — <https://docs.polar.sh/api-reference/refunds/create>
- POST /v1/discounts/ — <https://docs.polar.sh/api-reference/discounts/create>
- GET /v1/webhooks/deliveries?endpoint_id={id} — <https://docs.polar.sh/api-reference/webhooks/list-deliveries>
- POST /v1/webhooks/endpoints/{id}/deliveries/{deliveryId}/redeliver — <https://docs.polar.sh/api-reference/webhooks/redeliver-delivery>

## Webhook events (catalog)

Source: <https://docs.polar.sh/api-reference/webhooks/intro> + sandbox observation
(`packages/features/payment/__fixtures__/polar/`).

| Event | Status | Fixture file |
|---|---|---|
| subscription.created | observed | subscription-created.json |
| subscription.updated | observed | subscription-updated.json |
| subscription.active | constructed (SDK + observed sub shape) | subscription-active.json |
| subscription.canceled | constructed (SDK + observed sub shape) | subscription-canceled.json |
| subscription.uncanceled | constructed (SDK + observed sub shape) | subscription-uncanceled.json |
| subscription.revoked | constructed (SDK + observed sub shape) | subscription-revoked.json |
| subscription.past_due | constructed (SDK + observed sub shape) | subscription-past-due.json |
| order.paid | observed (sub flavor); constructed (topup flavor) | order-paid-subscription.json, order-paid-topup.json |
| order.updated | constructed (SDK + observed order shape) | order-updated.json |
| order.refunded | constructed (SDK + observed order shape) | order-refunded.json |
| refund.created | constructed (SDK Refund$Outbound) | refund-created.json |
| checkout.expired | constructed (observed checkout.updated, status=expired) | checkout-expired.json |
| benefit_grant.cycled | constructed (SDK BenefitGrantWebhook) | benefit-grant-cycled.json |

(For "constructed" rows: recapture from sandbox the moment Polar emits them
during a real customer flow and overwrite the JSON file. Snapshot tests will
flag any drift.)

## Webhook signature format

Polar `format=raw`:
- Header `webhook-id`: ULID
- Header `webhook-timestamp`: unix seconds (string)
- Header `webhook-signature`: `v1,<base64(HMAC-SHA256(fullSecret, "${id}.${ts}.${body}"))>`
- The `fullSecret` includes the `polar_whs_` prefix — do NOT base64-decode it.
- Multiple sigs may be space-separated; any valid one passes.
- Replay tolerance: 5 minutes from `webhook-timestamp`.

Helper: `packages/features/payment/__fixtures__/polar/headers.fixture.ts` —
`buildPolarRawHeaders({ rawBody, secret, tamperSig?, prependDecoySig? })`.

## Drift policy

| When | Action |
|---|---|
| Snapshot test fails after Polar payload change | recapture observed fixture, re-run schemas, update zod if a load-bearing field is gone |
| New event type Polar adds | add fixture + barrel export + dispatcher case + update this table |
| Constructed fixture replaced by real observation | drop the "constructed" tag in the table; commit captures the diff |
