# INICIS Payment Reuse Feature

Reusable KG INICIS payment source for Product Builder.

## Source Map

| Area | Official source | Implemented module |
|---|---|---|
| PC standard checkout request, auth result, approval request, net cancel | https://manual.inicis.com/pay/stdpay_pc.html | `src/checkout.ts`, `src/approval.ts` |
| Full/partial cancel and refund V2 | https://manual.inicis.com/pay/cancel.html | `src/cancel.ts` |
| PC/mobile virtual-account noti response and retry rule | https://manual.inicis.com/pay/etc-noti.html | `src/noti.ts` |
| Transaction inquiry V2 | https://manual.inicis.com/pay/etc-inquiry.html | `src/inquiry.ts` |
| Billing key issue and billing approval | https://manual.inicis.com/pay/bill.html | `src/billing.ts` blocker only |

## Implemented Contract

- External INICIS field names are preserved in provider-facing payloads.
- PC standard checkout uses `mid`, `oid`, `price`, `timestamp`, `use_chkfake=Y`, `signature`, `verification`, `mKey`, `returnUrl`, `closeUrl`, and `acceptmethod=centerCd(Y)`.
- Approval accepts the INICIS auth result only after the local order, MID, OID/MOID, and amount match, then posts to the returned `authUrl` after validating `inicis.com` host and IDC name. If local validation fails after approval, the service requests `netCancel` and records a failed event instead of marking the order approved.
- Net cancel posts the same documented auth-token form fields to `netCancelUrl` when approval succeeds but local persistence fails.
- Return/callback and noti endpoints accept official `application/x-www-form-urlencoded` POST bodies.
- Noti/webhook validates `PAYMENT_INICIS_NOTI_ALLOWED_IPS` against the request source IP, records failures without marking orders paid, and returns exactly `OK` only after successful first or duplicate processing. Proxy-derived `x-forwarded-for` is trusted only when `PAYMENT_INICIS_TRUST_PROXY=true`.
- Approval, noti, and cancel/refund local order state changes are persisted together with their provider event records in a transaction.
- Cancel/refund and inquiry use V2 JSON endpoints and `hashData = SHA512(INIAPIKey + mid + type + timestamp + data)`. Cancel/refund mutates order state only when the documented business result code is successful (`00`).
- Raw provider payloads are masked before DB/admin exposure.

## Reuse Surface

Product Builder can reference these surfaces as `payment.inicis.*` capability entries. The code manifest is exported as `INICIS_PAYMENT_CAPABILITIES` from `src/capabilities.ts`.

| Capability | Source |
|---|---|
| `payment.inicis.config` | `src/config.ts` |
| `payment.inicis.checkout` | `src/checkout.ts` |
| `payment.inicis.approval` | `src/approval.ts` |
| `payment.inicis.noti` | `src/noti.ts` |
| `payment.inicis.cancel` | `src/cancel.ts` |
| `payment.inicis.inquiry` | `src/inquiry.ts` |
| `payment.inicis.billing.blocker` | `src/billing.ts` |
| `payment.inicis.vbank-refund.blocker` | `src/cancel.ts` |
| `payment.inicis.service` | `inicis.service.ts` |
| `payment.inicis.admin` | `apps/admin/src/features/payment/pages/inicis-page.tsx` |

## REST/Admin Surface

- Public: `POST /api/payment/inicis/checkouts`, `POST /api/payment/inicis/return`, `POST /api/payment/inicis/callback`, `GET /api/payment/orders/:orderId`
- Webhook: `POST /api/webhooks/inicis/noti`
- Admin: `GET /api/admin/payment/inicis/status`, `GET /api/admin/payment/inicis/orders`, `GET /api/admin/payment/inicis/orders/:orderId`, `GET /api/admin/payment/inicis/events`, `GET /api/admin/payment/inicis/events/:eventId`, `POST /api/admin/payment/inicis/orders/:orderId/cancel`, `POST /api/admin/payment/inicis/orders/:orderId/refund`, `POST /api/admin/payment/inicis/orders/:orderId/inquiry`, `POST /api/admin/payment/inicis/events/:eventId/replay`

Admin UI route: `/payment/inicis`. It supports order search by order id, TID, user id, status, and period; event search by order id, TID, idempotency key, status, and period; masked order/event detail; approval/noti/cancel/refund timeline; config readiness including noti IP allowlist presence without exposing values; cancel/refund confirmation; inquiry; and replay markers.

Admin mutations (`cancel`, `refund`, `inquiry`, `replay`) are wrapped with `payment_audit_log` entries via the payment audit service.

## Persistence

- `payment_inicis_orders`: local order id, user id, `oid` mapping, `tid`, auth token reference, amount, payment method, order status, provider result code/message, masked buyer values, approved/paid/canceled timestamps, refunded amount, masked raw payload, normalized metadata.
- `payment_inicis_events`: return/approval/noti/cancel/inquiry/replay event log with unique idempotency key, source IP, provider result code/message, masked raw payload, normalized metadata, processed timestamp.
- Migration: `packages/drizzle/migrations/0038_payment_inicis.sql`.

## Verification

- Unit tests: `pnpm --filter @repo/features exec jest payment/inicis/inicis.spec.ts payment/controller/inicis.controller.spec.ts --runInBand`
- Covered: checkout signature/verification/mKey, checkout idempotency conflict guard, approval POST signature and INICIS host/IDC guard, approval local-order amount mismatch with netCancel, PC/mobile noti normalization and `OK` response, noti IP allowlist failure, noti idempotency/order paid update, Cancel/Inquiry V2 hashData, cancel business failure without refund state mutation, partial refund remaining-balance validation, masking, config readiness without secret/IP exposure, billing blocker, masked order detail timeline, explicit entitlement blocker, and admin audit logging for INICIS mutations.

## Blockers

- Real merchant MID/signKey/INIAPIKey/client IP are not present in this workspace.
- Production noti source IPs must be configured in `PAYMENT_INICIS_NOTI_ALLOWED_IPS`; missing or nonmatching source IPs are recorded as failed events and do not mark orders paid.
- `PAYMENT_INICIS_TRUST_PROXY` defaults to false. Enable it only when the deployment path preserves the original INICIS client IP in `x-forwarded-for`.
- Billing is not marked reusable until merchant billing contract and INILite Key are verified.
- Entitlement grant/revoke is intentionally blocked at the reusable INICIS provider layer. Product Builder must attach a product-specific credit/subscription entitlement adapter before paid INICIS orders can grant or revoke access.
- Virtual-account refund is not marked reusable yet. The official Cancel API V2 requires encrypted refund account fields (`refundAcctNum` as `ENC`), and this workspace does not contain verified encryption key/material or an official test vector for that path.
- Production returnUrl/notiUrl matching with INICIS merchant settings requires deployed preview/prod URLs.
