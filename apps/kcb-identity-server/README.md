# KCB Identity Server

Java adapter service for KCB/Ok-name identity verification.

This service is intentionally separate from the Node/Vercel API runtime because
KCB integrations can require official JAR, license, `.dat`, and native library
artifacts. Those files must be injected by deployment secrets/artifacts and must
not be committed.

The AIGA delivery runs this service on **Railway** (Vercel/Node cannot execute the
JAR). The JVM execution-boundary decision, network boundary, timeout/retry, and
secret/artifact policy are recorded in
`docs/features/identity-verification/kcb-jar-adapter.md`; the deploy descriptor is
`railway.json` and the internal Node↔JAR contract is `openapi.internal.yaml`.

## Railway deployment

- Build: `railway.json` uses the existing `Dockerfile` (Temurin 17).
- Health check: Railway probes `GET /health` (`healthcheckPath`); HTTP 200 = up.
- Artifacts: mount a Railway **Volume** at `/artifacts` with the official JAR +
  license (gitignored, never baked into the image) and point
  `KCB_MODULE_JAR_PATH` / `KCB_LICENSE_PATH` at the mounted paths.
- Variables: set the `KCB_*` service variables (see "Required Environment"); the
  Vercel/Node API reaches this service at its public HTTPS URL via
  `KCB_ADAPTER_BASE_URL` with the shared `KCB_INTERNAL_AUTH_TOKEN` bearer.
- Reference: Java deploy https://docs.railway.com/guides/spring-boot · variables
  https://docs.railway.com/variables · private networking
  https://docs.railway.com/networking/private-networking (Railway↔Railway only;
  Vercel calls over public TLS).

## Endpoints

- `GET /health`
- `POST /internal/kcb/standard/request`
- `POST /internal/kcb/standard/verify`
- `POST /internal/kcb/custom/request`
- `POST /internal/kcb/custom/verify`
- `POST /internal/kcb/decrypt-result`

All `/internal/**` endpoints require `Authorization: Bearer $KCB_INTERNAL_AUTH_TOKEN`.

## Required Environment

- `KCB_MODE=PROD`
- `KCB_SITE_CODE`
- `KCB_SERVICE_CODE`
- `KCB_MODULE_JAR_PATH`
- `KCB_LICENSE_PATH`
- `KCB_NATIVE_LIB_PATH`
- `KCB_LOG_DIR`
- `KCB_STANDARD_RETURN_URL`
- `KCB_STANDARD_CALLBACK_URL`
- `KCB_INTERNAL_AUTH_TOKEN`
- `KCB_OFFICIAL_SOURCE_MAP`

`KCB_OFFICIAL_SOURCE_MAP` should point to the internal record that maps:
official contract, official integration guide, production site code, KCB-provided
test-period approval, JAR version/checksum, license/dat path, native library
requirements, callback allowlist, and result code table.

KCB no longer provides a separate TEST target/site for this integration. Use the
production contract, production site code, and production license with
`KCB_MODE=PROD`; KCB opens a limited test period on the production environment
when live verification is needed.

## Current Integration Boundary

The server validates configuration and file readability through `/health`.
Standard phone popup mode is wired to the official OkCert3 Java module:

- Start: `OkCert.callOkCert(target, cpCd, "IDS_HS_POPUP_START", license, params)`
- Result: `OkCert.callOkCert(target, cpCd, "IDS_HS_POPUP_RESULT", license, params)`
- Popup submit: `tc=kcb.oknm.online.safehscert.popup.cmd.P931_CertChoiceCmd`,
  `cp_cd`, `mdl_tkn`

Custom mode remains blocked until a separate official custom-mode contract and
fixtures are supplied.

## Official Source Map

The implementation is based on the attached Korea Medicare KCB package:

- `KCB_OkCert3_본인확인서비스_1.공통가이드_v3.1.docx` — gateway and popup URLs,
  network/TLS prerequisites
- `KCB_OkCert3_본인확인서비스_2.JAVA모듈가이드.docx` — `kcb.module.v3.OkCert`
  and `callOkCert(...)`
- `KCB_OkCert3_본인확인서비스_3.휴대폰본인확인_팝업.docx` —
  `IDS_HS_POPUP_START`, `IDS_HS_POPUP_RESULT`, request/response keys
- `jsp_phone_popup.zip` — JSP sample pages `phone_popup1.jsp` through
  `phone_popup4.jsp`
- `OkCert3-java1.5-2.3.5.jar` — official Java module
- `V72010000000_IDS_01_PROD_AES_license.dat` — provided production IDS AES
  license

## Local Artifact Directories

The following directories are placeholders only:

- `artifacts/jar/`
- `artifacts/license/`
- `artifacts/native/`

Keep only `.gitkeep` files here.

For local demo execution, copy supplied artifacts into the ignored local
directories:

```bash
cp .context/attachments/ETG9Fm/extracted/모듈_unzipped/OkCert3-java1.5-2.3.5.jar \
  apps/kcb-identity-server/artifacts/jar/
cp .context/attachments/ETG9Fm/extracted/라이센스/V72010000000_IDS_01_PROD_AES_license.dat \
  apps/kcb-identity-server/artifacts/license/
```

Required local environment for the supplied production license. Do not set
`KCB_MODE=TEST` for new validation; current KCB validation is always PROD during
the KCB-provided test period:

```bash
export KCB_MODE=PROD
export KCB_SITE_CODE=V72010000000
export KCB_SITE_NAME='코리아메디케어'
export KCB_SITE_URL='https://<demo-domain>'
export KCB_POPUP_URL='https://safe.ok-name.co.kr/CommonSvl'
export KCB_STANDARD_RETURN_URL='https://<api-domain>/api/identity-verifications/kcb/return'
export KCB_INTERNAL_AUTH_TOKEN='<internal-token>'
export KCB_MODULE_JAR_PATH="$PWD/apps/kcb-identity-server/artifacts/jar/OkCert3-java1.5-2.3.5.jar"
export KCB_LICENSE_PATH="$PWD/apps/kcb-identity-server/artifacts/license/V72010000000_IDS_01_PROD_AES_license.dat"
export KCB_OFFICIAL_SOURCE_MAP='Korea Medicare KCB package 2026-06-17'
```
