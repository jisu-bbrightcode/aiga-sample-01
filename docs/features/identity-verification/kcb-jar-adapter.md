# KCB JAR Execution Boundary / JVM Adapter (PB-IDV-KCB-JAR-001)

Issue: `BBR-571` · Decision: `EXTEND` · Capability: `identity-verification.kcb.jar-bridge`
Reuse source: `product-builder-base:apps/kcb-identity-server@base/v1-111d7721`

This document records the deployment-boundary decision for running the official
KCB OkCert3 Java module in the AIGA delivery, which is fixed to a Neon + Vercel
base where no JVM exists. The KCB capability code (Java adapter, Node client,
DTOs, UI, admin, error mapping) is already implemented and REUSE-verified by
`PB-IDV-KCB-001` (`BBR-570`); see [`kcb.md`](./kcb.md). This issue only resolves
**where the JVM runs and how the Vercel/Node API reaches it**.

## 1. Decision

- **The KCB OkCert3 JAR is never executed inside a Node/Next.js/Vercel function.**
  Vercel functions have no JVM, an ephemeral read-only filesystem unsuitable for
  the official `.jar` + AES `.dat` license + native libs, short execution limits,
  and no stable outbound identity for the KCB allowlist. The JAR runs only in the
  dedicated Spring Boot service at `apps/kcb-identity-server`.
- **JVM execution location: a separate Railway service** running the existing
  `apps/kcb-identity-server` Docker image. Railway is selected over Fly.io /
  Render / ECS because the service already ships a `Dockerfile`, Railway gives
  first-class secret/volume injection for the un-committable JAR + license, a
  managed health check, per-service variables, and private networking between
  co-located services.
- **Network boundary:** the Vercel/Node API calls the Railway adapter over its
  **public HTTPS domain (TLS)**, authenticated on every functional call by the
  shared `KCB_INTERNAL_AUTH_TOKEN` bearer (enforced by `InternalAuthFilter` on
  all `/internal/**` routes). Vercel is **not** a member of Railway's private
  network, so `*.railway.internal` private networking is only used for
  Railway→Railway calls (e.g. if a future worker is co-located). This is a hard
  constraint, not a preference — see §3.
- **Custom mode stays disabled** (`KCB_CUSTOM_MODE_ENABLED=false`) until an
  official custom-mode contract + fixtures exist; only standard phone-popup is in
  scope.

### Railway reference documentation (official)

- Java/Spring Boot deploy: https://docs.railway.com/guides/spring-boot
- Deployment reference: https://docs.railway.com/deployments/reference
- Service variables: https://docs.railway.com/variables
- Private networking: https://docs.railway.com/networking/private-networking

## 2. Candidate review

| Host | JVM | Mount JAR/license secret artifacts | Outbound to `safe.ok-name.co.kr` | Health check | Verdict |
|------|-----|-----------------------------------|----------------------------------|--------------|---------|
| Vercel/Node (base) | ✗ no JVM | ✗ ephemeral FS | ✓ | n/a | **Rejected** — cannot run the JAR |
| **Railway (chosen)** | ✓ Temurin 17 image | ✓ volume + variables | ✓ | ✓ `healthcheckPath` | **Selected** |
| Fly.io | ✓ | ✓ volumes/secrets | ✓ | ✓ | Viable alternative; no extra benefit, base has no Fly config |
| Render | ✓ | ✓ secret files | ✓ | ✓ | Viable alternative |
| AWS ECS/Fargate | ✓ | ✓ | ✓ | ✓ | Heaviest ops; defer to customer-infra porting (`PB-PORT-001`) only if required |

Porting workflow (`PB-PORT-001`) is **not required** for standard mode: Railway
satisfies every acceptance constraint. Customer-infra porting is only triggered
if AIGA mandates hosting KCB inside their own cloud.

## 3. Network boundary & exposure

```
Browser ──(KCB popup, public)──► safe.ok-name.co.kr
   ▲                                   │
   │ popup-return (same-origin)        ▼ outbound from adapter
Vercel (apps/app + apps/server / Node API)
   │  KCB_ADAPTER_BASE_URL = https://<svc>.up.railway.app
   │  Authorization: Bearer KCB_INTERNAL_AUTH_TOKEN   (every /internal/** call)
   ▼ public TLS edge
Railway service: apps/kcb-identity-server (Spring Boot, JVM 17)
   • /health           → public, unauthenticated (liveness only)
   • /internal/kcb/**  → bearer-gated (InternalAuthFilter), 401 without token
   • mounts /artifacts (JAR + license, read-only volume)  ── never committed
   • outbound HTTPS → safe.ok-name.co.kr (OkCert3 gateway)
```

Exposure hardening required at provisioning time:
- Railway public domain stays HTTPS-only; bearer token is mandatory and rotated
  via Railway variables.
- `KCB_INTERNAL_AUTH_TOKEN` is a high-entropy shared secret set identically in
  the Vercel project env and the Railway service variables.
- Only `/health` is reachable unauthenticated; it returns readiness blockers but
  never any name/phone/CI/DI/secret material.
- If stricter isolation is later required, co-locate the Node API or a thin proxy
  on Railway and switch to `*.railway.internal` private networking (no public
  exposure of `/internal/**`).

## 4. Timeout & retry policy

| Hop | Timeout | Retry | Rationale |
|-----|---------|-------|-----------|
| Node→adapter (all) | `KcbAdapterClient` AbortController, 10s (`timeoutMs`) | — | bounded fail-fast |
| adapter→KCB gateway | `KCB_CONNECT_TIMEOUT_MS`=10000, `KCB_READ_TIMEOUT_MS`=10000 | — | matches KCB latency budget |
| `GET /health` | 10s | safe to retry | read-only, idempotent |
| `POST /internal/kcb/standard/request` | 10s | retryable ≤2 w/ backoff | start creates a fresh `MDL_TKN`; a retry just yields a new request, no double effect |
| `POST /internal/kcb/standard/verify`, `/decrypt-result` | 10s | **no auto-retry** | the popup token is single-use; auto-retrying an ambiguous timeout risks double-consuming a real success. On timeout/5xx surface `provider_rejected`; the user re-initiates a new session |

Adapter is **stateless** between calls (session state lives in the Node/Neon DB),
so a Railway replica restart never loses verification state.

## 5. Health check

- **Railway deploy health** (`railway.json` → `healthcheckPath: /health`):
  process liveness. HTTP 200 = up. KCB config blockers do **not** fail the deploy
  (a misconfigured-but-running service is still "deployed"); readiness is a
  separate operational signal.
- **Functional readiness** (operator-facing): `GET /api/admin/identity-verifications/kcb/health`
  proxies the adapter `/health` and surfaces `blockers[]`
  (`jar_required`, `license_required`, `official_documents_required`, …) plus the
  JAR `sha256` checksum so operators confirm the right artifact is mounted before
  enabling the feature.

## 6. Secret / artifact management

- **Never committed.** `apps/kcb-identity-server/artifacts/{jar,license,native}/`
  hold only `.gitkeep`; the real `OkCert3-*.jar` and `V72010000000_IDS_01_PROD_AES_license.dat`
  are gitignored and injected at deploy time. The `Dockerfile` explicitly does
  not bake them into the image.
- **Railway injection:** mount a Railway **Volume** at `/artifacts` containing the
  JAR + license (binary, persistent), and point `KCB_MODULE_JAR_PATH` /
  `KCB_LICENSE_PATH` at the mounted paths. The token + URLs are Railway service
  **variables**.
- **Provenance:** `KCB_OFFICIAL_SOURCE_MAP` records the contract / site code /
  JAR version+checksum / license path / allowlist source of truth.
- License/JAR distribution is bound by the KCB contract; storage location is the
  Railway volume + the customer's secret manager, not the repo.

### Environment mapping

Vercel/Node API (declared in `apps/server/src/config/env.ts`):

| Var | Purpose |
|-----|---------|
| `KCB_ADAPTER_BASE_URL` | Railway public HTTPS URL of the adapter |
| `KCB_INTERNAL_AUTH_TOKEN` | shared bearer (same value on Railway) |
| `KCB_STANDARD_RETURN_URL` | popup return path on the Vercel API origin |
| `KCB_STANDARD_CALLBACK_URL` | optional server callback |
| `KCB_CUSTOM_MODE_ENABLED` | `false` until official custom contract |
| `KCB_RETENTION_DAYS` | CI/DI/result retention window |

Railway adapter service variables: `KCB_MODE=PROD`, `KCB_SITE_CODE`,
`KCB_SITE_NAME`, `KCB_SITE_URL`, `KCB_POPUP_URL`, `KCB_STANDARD_RETURN_URL`,
`KCB_INTERNAL_AUTH_TOKEN`, `KCB_OFFICIAL_SOURCE_MAP`, `KCB_MODULE_JAR_PATH`,
`KCB_LICENSE_PATH`, `KCB_NATIVE_LIB_PATH`/`KCB_NATIVE_LIB_REQUIRED` (if needed),
`KCB_CONNECT_TIMEOUT_MS`, `KCB_READ_TIMEOUT_MS`, `KCB_LOG_DIR`.

## 7. Internal contract (Node ↔ JAR adapter)

Explicit, machine-readable contract:
[`apps/kcb-identity-server/openapi.internal.yaml`](../../../apps/kcb-identity-server/openapi.internal.yaml).
It mirrors the typed DTOs in
`packages/features/identity-verification/kcb/contracts.ts` and the Spring
`KcbController`. Endpoints: `GET /health`,
`POST /internal/kcb/standard/{request,verify}`,
`POST /internal/kcb/custom/{request,verify}` (501 until official contract),
`POST /internal/kcb/decrypt-result`. All `/internal/**` require the bearer.

## 8. Failure / log-masking states

- **User-facing:** Node maps adapter errors to stable codes via
  `toPublicKcbError` / `publicMessageForCode` (Korean, non-technical). Adapter
  timeouts/5xx → `provider_rejected` ("본인확인을 처리하지 못했습니다…"). No raw
  provider reason, status code, or stack trace reaches the UI (per repo
  user-facing-error policy).
- **Operator-facing:** raw `blockers[]` + checksums via the admin health endpoint;
  adapter logs go to `KCB_LOG_DIR`.
- **Log masking:** no RRN, no raw KCB request/response payload, no license/key
  material is logged or stored; only masked name/phone, hashed CI/DI (if policy
  allows), and normalized result code/message persist (see `kcb.md` §Data Policy).

## 9. Deployment constraints & remaining blockers

The decision/contract/descriptor work is complete and committed. Going live still
needs operator + customer inputs that are **out of this issue's scope** (mirrors
`PB-INFRA-001` dummy-state → real-provisioning split):

1. **Real Railway provisioning** — create the Railway project/service, mount the
   artifact volume, set production variables, deploy, and capture the public URL +
   `/health` output. Owner: operator/platform. Delegated to a child issue.
2. **Customer KCB contract + artifacts** — production site code, license `.dat`,
   official JAR, callback/return allowlist. External blocker already tracked under
   `PB-IDV-KCB-001` (`BBR-570`) customer-contract dependency. Without it the
   adapter `/health` reports `official_documents_required` / `license_required`
   and the feature stays gated.

No source-code porting workflow is required for the standard mode on Railway.
