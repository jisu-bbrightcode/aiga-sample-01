# KCB Identity Verification Reusable Checklist

## Artifact Readiness

- [ ] Official KCB/Ok-name contract is linked in source map.
- [ ] Official integration guide is linked in source map.
- [ ] Test account and site/service code are available.
- [ ] JAR version and checksum are recorded.
- [ ] License/dat file path is injected outside git.
- [ ] Native library path is injected outside git.
- [ ] Callback/return URL allowlist matches deployment.

## Java Adapter

- [ ] `GET /health` returns `ok: true`.
- [ ] Health includes readable JAR/license/native states.
- [ ] Internal endpoints reject missing bearer token.
- [ ] Standard request uses official guide-backed fields only.
- [ ] Standard verify decrypts and validates official fixture.
- [ ] Callback replay and forged state are rejected.
- [ ] Custom mode remains disabled unless official docs permit it.

## Node API

- [ ] Session create stores state/nonce hash only.
- [ ] Session create does not store raw provider payload.
- [ ] Callback/return updates `verified`, `failed`, `canceled`, and `expired`.
- [ ] Result persistence stores only masked/minimal identity data.
- [ ] Admin list/detail require admin auth.
- [ ] Admin health surfaces adapter blockers.

## UI

- [ ] Protected action gate starts KCB standard mode.
- [ ] Return panel handles success/fail/cancel/expired.
- [ ] User-facing errors use stable codes and localized fallback copy.
- [ ] Raw provider message, reason, request id, and stack trace are not rendered.

## Product Builder REUSE Mapping

- [ ] `PB-IDV-KCB-001` maps to `packages/features/identity-verification/kcb`.
- [ ] `PB-IDV-KCB-JAR-001` maps to `apps/kcb-identity-server`.
- [ ] `PB-IDV-KCB-DATA-001` maps to `packages/features/identity-verification/schema`.
- [ ] `PB-IDV-KCB-API-SESSION-001` maps to REST session API.
- [ ] `PB-IDV-KCB-CALLBACK-001` maps to callback/return API.
- [ ] `PB-IDV-KCB-API-STATUS-001` maps to session read/admin health API.
- [ ] `PB-IDV-KCB-UI-001` maps to `packages/features/identity-verification/ui`.
- [ ] `PB-IDV-KCB-ADMIN-001` maps to `apps/admin/src/features/identity-verification`.
- [ ] `PB-IDV-KCB-QA-001` maps to this checklist.
