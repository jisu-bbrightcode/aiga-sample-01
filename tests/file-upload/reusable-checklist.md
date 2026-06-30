# File Upload Reusable Checklist

Vercel Blob client-upload capability QA checklist (PB-FILE-QA-001 / BBR-556).
Mirrors the `tests/video-lecture/reusable-checklist.md` and
`tests/identity-verification/reusable-checklist/kcb.md` format.

`[x]` = verified against the delivery branch (`main`). `[ ]` = not yet
verifiable — either requires a live environment, or the implementing PR is not
yet merged into `main` (see **Blocked — pending dependency merge**).

## Automated (verified on `main`)

- [x] Upload policy allows only `image/png|jpeg|webp|gif` and `application/pdf`.
- [x] Upload policy blocks executables/scripts and `image/svg+xml` (XSS) by omission.
- [x] Size ceiling enforced at 10 MB (`DEFAULT_MAX_UPLOAD_BYTES`); over-size → `size_exceeded` (422).
- [x] Filename safety: path separators, control chars, dotfiles, traversal, and `>255` rejected.
- [x] Extension must agree with the declared MIME type (`extension_mismatch`).
- [x] Token issuance binds the upload to a server-generated, unguessable pathname (`uploads/{visibility}/{YYYY}/{MM}/{ulid}.{ext}`, `addRandomSuffix:false`).
- [x] Server never trusts the client upload result: completion re-reads Blob `head` and re-validates against policy (`validateCompletedBlob`).
- [x] Completion is idempotent — an already-`ready` row converges to the same asset.
- [x] Completion re-verifies ownership against the authenticated caller; unknown id or non-owner → 404 with no existence leak.
- [x] Orphan rollback: a token issued but no bytes landed (or a policy-violating blob) → row marked `failed` and bytes best-effort deleted; pending rows carry a 24 h TTL (`expiresAt`) for sweep.
- [x] Pathname-mismatch / arbitrary Blob URL injection is rejected (`head.pathname !== row.pathname`).
- [x] List is owner-scoped (`GET /files`) — a caller cannot widen scope; `deleted` rows are never returned to owners.
- [x] Admin list (`GET /admin/files`) is a separate operator surface; `deleted` hidden unless `includeDeleted`.
- [x] Metadata edit allow-lists fields; owner cannot set moderation `reviewStatus` (admin-only).
- [x] Reusable upload UI surfaces client + server validation errors, progress/cancel/retry/complete, and gates the protected upload action behind the auth modal.
- [x] `BLOB_READ_WRITE_TOKEN` and `FILE_UPLOAD_PUBLIC_BASE_URL` are declared in the server env schema and `.env.example`; token absence degrades gracefully (no callback attached / 503 on read, never a crash).

## Blocked — pending dependency merge

These acceptance items depend on capability PRs that are marked `done` in the
tracker but are **not yet merged into `main`**, so they cannot be verified
against the delivery branch.

- [ ] Read/access policy for `GET /files/:id` (public vs private vs owner; identical 404 on deny/missing/deleted) — implemented in **PR #71 (BBR-551), OPEN**.
- [ ] Unauthorized **delete** rejection — owner soft-delete + admin force-delete + 404 no-leak — implemented in **PR #74 (BBR-553), OPEN**.
- [ ] Orphan **cleanup sweep** endpoint (`POST /admin/files/cleanup`) and no-dangling-reference guarantee after delete — implemented in **PR #74 (BBR-553), OPEN**.
- [ ] Admin **file management / audit UI** (`apps/admin`) — implemented in **PR #92 (BBR-555), OPEN**.

## Manual / Environment Required

- [ ] `BLOB_READ_WRITE_TOKEN` exists in Vercel **Development**, **Preview**, and **Production** envs (Vercel dashboard / `vercel env ls` — requires project access).
- [ ] `FILE_UPLOAD_PUBLIC_BASE_URL` set to the deployed server origin so completion callbacks are attached.
- [ ] Allowed file (PNG/JPG/WebP/GIF/PDF ≤ 10 MB) uploads successfully end-to-end from the deployed URL.
- [ ] Over-size file is rejected before bytes leave the client / at token issuance.
- [ ] Forbidden MIME (e.g. `.exe`, `.svg`, `.html`) is rejected.
- [ ] Anonymous user hitting a protected upload sees the auth modal, not a raw error.
- [ ] A second user cannot read/delete another user's private file (403/404).
- [ ] After delete/cleanup, the Blob object is gone and no DB row references a missing object (and vice-versa).
- [ ] Deployed admin file-management UI lists, filters, and moderates uploads.
