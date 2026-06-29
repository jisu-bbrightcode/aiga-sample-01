# KCB/Ok-name Identity Verification Capability

## Status

Reusable capability boundary is implemented and the standard phone-popup START
flow is verified live against KCB production: `IDS_HS_POPUP_START` returns
`RSLT_CD=B000` with a real `MDL_TKN` + `TX_SEQ_NO` using the official JAR and the
`V72010000000` IDS AES license. RESULT (`IDS_HS_POPUP_RESULT`) runs through the
identical `callOkCert` path and requires a human-completed popup token.

End-to-end browser flow:

- Web app demo route (`apps/app` → `/identity-verification`) creates a session,
  opens the KCB popup (POST form to `CommonSvl`), and polls session status.
- The KCB popup returns to the server `popup-return` endpoint, which renders a
  tiny same-origin page that notifies the opener and self-closes.

Remaining for full live completion:

- Official docs/JSP samples are kept under `.context/attachments/` and converted
  to text alongside; official JAR/license are copied only to ignored local
  artifact paths and must not be committed.
- KCB does not provide a separate TEST environment for the current contract.
  Validation uses `KCB_MODE=PROD` with the production site code/license during
  the test period opened by KCB.
- A human must complete one popup phone verification to exercise RESULT decode.
- For non-local hosting, the Java bridge needs a Java-capable host (it cannot run
  on Vercel) with outbound access to `safe.ok-name.co.kr`, and the deployed
  `KCB_STANDARD_RETURN_URL` / `KCB_SITE_URL` must match the KCB contract allowlist.

## REUSE Sources

- `product-builder-base:packages/features/identity-verification/kcb@<commit>`
- `product-builder-base:packages/features/identity-verification/schema@<commit>`
- `product-builder-base:packages/features/identity-verification/rest-api@<commit>`
- `product-builder-base:packages/features/identity-verification/ui@<commit>`
- `product-builder-base:apps/admin/features/identity-verification@<commit>`
- `product-builder-base:apps/kcb-identity-server@<commit>`
- `product-builder-base:tests/identity-verification/reusable-checklist@<commit>`

## Capability Registry

Runtime export:

```ts
import { identityVerificationCapabilityRegistry } from "@repo/features/identity-verification";
```

Registered IDs:

- `identity-verification.kcb.standard`
- `identity-verification.kcb.jar-bridge`
- `identity-verification.kcb.schema`
- `identity-verification.kcb.rest-api`
- `identity-verification.kcb.ui`
- `identity-verification.kcb.admin`
- `identity-verification.kcb.qa`

## Architecture

- Node/Nest API owns sessions, nonce/state hash, replay protection, result
  persistence, protected-action resume metadata, and admin audit actions.
- Java adapter service under `apps/kcb-identity-server` owns official JAR,
  license, OkCert3 invocation, result normalization, and adapter health.
- Standard phone popup mode calls official `IDS_HS_POPUP_START` and
  `IDS_HS_POPUP_RESULT` through `kcb.module.v3.OkCert`.
- Custom mode is disabled unless `KCB_CUSTOM_MODE_ENABLED=true` and official
  documents/fixtures confirm the payload and required notices.

## Data Policy

Stored:

- provider, mode, user id
- target action/resource
- session status
- state/nonce hash only
- request id and provider transaction id if supplied by official module
- CI/DI hash only if official policy allows retention
- masked name, masked phone, minimal birth field only when required
- normalized result code/message
- retention/delete fields and audit metadata

Never stored:

- resident registration number
- raw KCB request payload
- raw KCB response payload
- encryption key, license, or native artifact
- full phone number unless a future approved policy explicitly requires it

## REST API

Public/app API:

- `POST /api/identity-verifications/kcb/sessions`
- `GET /api/identity-verifications/kcb/sessions/:sessionId`
- `POST /api/identity-verifications/kcb/sessions/:sessionId/link`
- `GET /api/identity-verifications/kcb/me`
- `POST /api/identity-verifications/kcb/callback`
- `POST /api/identity-verifications/kcb/return`
- `GET|POST /api/identity-verifications/kcb/popup-return` — browser return target
  for the KCB popup (HTML, excluded from OpenAPI). Set `KCB_STANDARD_RETURN_URL`
  to this path. Renders a same-origin page that posts `{sessionId, status}` to the
  opener and closes; no name/phone/CI/DI is ever placed in the page.
- `POST /api/identity-verifications/kcb/custom/start`
- `POST /api/identity-verifications/kcb/custom/verify`

Admin API:

- `GET /api/admin/identity-verifications`
- `GET /api/admin/identity-verifications/:id`
- `GET /api/admin/identity-verifications/kcb/health`
- `POST /api/admin/identity-verifications/:id/retry`
- `POST /api/admin/identity-verifications/:id/archive`

Admin UI:

- `/identity-verification` lists sessions and Java adapter readiness blockers.
- `/identity-verification/:sessionId` shows session detail, provider event
  timeline, consent versions, masked result fields, and retention/delete state.

## Web app demo flow

`apps/app` route `/identity-verification` (auth-guarded) drives the full popup
flow with the reusable UI blocks:

1. User consents and starts → `POST /sessions` returns `redirectUrl` +
   `redirectForm` (the KCB `CommonSvl` POST payload).
2. `openKcbPopup` opens a popup and auto-submits the form to KCB.
3. User completes phone verification; KCB returns to `popup-return`, which posts
   `{sessionId, status}` to the opener (same origin) and closes.
4. The host page polls `GET /sessions/:id` (and reacts to the popup message) and
   shows the result via `KcbReturnPanel`.

## Local / Docker run

The Java bridge runs anywhere with a JRE and outbound access to
`safe.ok-name.co.kr`. The official JAR + license are mounted at runtime and are
never baked into the image.

Docker (Postgres + Java bridge):

```bash
cd apps/kcb-identity-server
cp .env.demo.example .env            # fill KCB_SITE_CODE / token / URLs
# place official artifacts (gitignored):
#   artifacts/jar/OkCert3-java1.5-2.3.5.jar
#   artifacts/license/V72010000000_IDS_01_PROD_AES_license.dat
docker compose -f docker-compose.demo.yml up --build
curl localhost:18999/health         # expect ok:true, blockers:[]
```

Without Docker (Maven on host):

```bash
cd apps/kcb-identity-server
mvn -DskipTests package
KCB_MODE=PROD KCB_SITE_CODE=... KCB_INTERNAL_AUTH_TOKEN=... \
KCB_MODULE_JAR_PATH="$PWD/artifacts/jar/OkCert3-java1.5-2.3.5.jar" \
KCB_LICENSE_PATH="$PWD/artifacts/license/V72010000000_IDS_01_PROD_AES_license.dat" \
SERVER_PORT=18999 java -jar target/kcb-identity-server-0.1.0.jar
```

Then run the Node side on the host so the browser flow works end to end:

```bash
# point Nest at the Java bridge + shared token + popup return URL
export KCB_ADAPTER_BASE_URL=http://localhost:18999
export KCB_INTERNAL_AUTH_TOKEN=<same token as the Java bridge>
export KCB_STANDARD_RETURN_URL=http://localhost:3000/api/identity-verifications/kcb/popup-return
pnpm --filter server dev             # Nest on :3002
pnpm --filter app dev                # Web app on :3000 (proxies /api -> :3002)
# open http://localhost:3000/identity-verification
```

## Source Map Required Before Live Enablement

Set `KCB_OFFICIAL_SOURCE_MAP` in the Java adapter deployment to an internal
record that confirms:

- official contract
- official integration guide
- production site/service code
- KCB-approved production test period
- JAR version/checksum
- license/dat path
- native library requirements
- request endpoint and callback/return URL allowlist
- standard/custom support
- field list and encryption/decryption rules
- result code table
- CI/DI retention policy

## Environment

Node API:

- `KCB_ADAPTER_BASE_URL`
- `KCB_INTERNAL_AUTH_TOKEN`
- `KCB_STANDARD_RETURN_URL`
- `KCB_STANDARD_CALLBACK_URL`
- `KCB_CUSTOM_MODE_ENABLED`

Java adapter:

- `KCB_MODE` (`PROD`; KCB does not support a separate TEST target for current validation)
- `KCB_SITE_CODE`
- `KCB_SERVICE_CODE`
- `KCB_MODULE_JAR_PATH`
- `KCB_LICENSE_PATH`
- `KCB_NATIVE_LIB_PATH`
- `KCB_NATIVE_LIB_REQUIRED`
- `KCB_LOG_DIR`
- `KCB_SITE_NAME`
- `KCB_SITE_URL`
- `KCB_POPUP_URL`
- `KCB_STANDARD_RETURN_URL`
- `KCB_STANDARD_CALLBACK_URL`
- `KCB_INTERNAL_AUTH_TOKEN`
- `KCB_OFFICIAL_SOURCE_MAP`
- `KCB_CONNECT_TIMEOUT_MS`
- `KCB_READ_TIMEOUT_MS`
