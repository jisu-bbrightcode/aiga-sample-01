# PB-FILE-QA-001 — 파일 업로드 E2E/보안/운영 검증 (BBR-556)

- Capability: `file-upload.qa`
- Decision: `EXTEND` — reuse the verified base capability; QA the customer delivery branch.
- Delivery branch verified: `main` @ `e185383`
- Reusable checklist: [`tests/file-upload/reusable-checklist.md`](../../tests/file-upload/reusable-checklist.md)
- Verified by: Product Builder QA (agent `ecb45acc`)

> **Disposition: BLOCKED.** The validation/security/consistency surface that is
> merged into `main` passes (67 automated tests, see §3). However three
> acceptance items depend on capability PRs that are marked `done` in the
> tracker but are **not merged into `main`**, and two items require Vercel
> environment access this run does not have. See §5.

---

## 1. Scope

Verify the Vercel Blob file-upload capability: Blob env, upload start/complete,
list/read/update/delete API, user UI, admin UI, permission errors,
size/type validation, and orphan cleanup.

## 2. What is actually on the delivery branch (`main`)

A QA engineer verifies the **delivery branch**, not the tracker status. The
file-upload capability is split across several PRs; their real merge state:

| Capability | Issue | PR | On `main`? |
|---|---|---|---|
| Data model (`file_assets`) | BBR-547 | #18 | ✅ merged |
| Create / client-upload token | BBR-548 | #23 | ✅ merged |
| Complete / confirm | BBR-549 | #32 | ✅ merged |
| List (owner + admin) | BBR-550 | #45 | ✅ merged |
| Metadata update (`PATCH`) | BBR-552 | #79 | ✅ merged |
| Reusable upload UI | BBR-554 | #50 | ✅ merged |
| **Read / access URL** (`GET /files/:id`) | BBR-551 | **#71** | ❌ **OPEN** |
| **Delete / Blob cleanup** | BBR-553 | **#74** | ❌ **OPEN** |
| **Admin file mgmt / audit UI** | BBR-555 | **#92** | ❌ **OPEN** |

> BBR-553 and BBR-555 are listed dependencies of this QA issue and show `done`,
> but their code is **not in `main`**. The delete/cleanup endpoints, the
> `GET /files/:id` access policy, and the admin management UI are therefore
> absent from the delivery branch and cannot be E2E-verified here.

## 3. Automated verification (PASS on `main`)

Commands run from the worktree (`packages/features`, `apps/app`):

```
# server policy + service (node:test via tsx)
node tsx --test file-upload/policy/*.node-test.ts file-upload/service/*.node-test.ts
→ tests 48 · pass 48 · fail 0

# server controllers (jest)
jest --testPathPatterns file-upload
→ Test Suites: 3 passed · Tests: 12 passed

# reusable upload UI (vitest)
vitest run src/features/file-upload/file-upload.test.tsx
→ Test Files 1 passed · Tests 7 passed
```

**Total: 67 automated tests green.**

### 3.1 Validation / security (AC#2 — partial)

`packages/features/file-upload/policy/upload-policy.ts` (pure, framework-free):

- **Allowed types:** `image/png|jpeg|webp|gif`, `application/pdf` only.
- **Blocked by omission:** executables/scripts and `image/svg+xml` (XSS) — never
  allow-listed, so token issuance is refused (`unsupported_content_type`, 422).
- **Size:** 10 MB ceiling; over-size → `size_exceeded` (422). The ceiling is also
  minted into the client token (`maximumSizeInBytes`), so Vercel rejects an
  over-size upload server-side even if the client lies.
- **Filename:** path separators, ASCII control chars, dotfiles/traversal
  (`.`, `..`), empty, and `>255` chars rejected (`invalid_filename`).
- **Extension ↔ MIME:** must agree (`extension_mismatch`).
- **Untrusted client:** the declared content-type only gates *whether a token is
  issued*. The stored pathname is **server-generated** (`uploads/{visibility}/
  {YYYY}/{MM}/{ulid}.{ext}`, `addRandomSuffix:false`), so the client is bound to
  an unguessable, collision-resistant location it cannot choose.

### 3.2 Upload→complete consistency & orphan cleanup (AC#3 — partial)

`file-upload.service.ts#completeUpload`:

- Reads the blob's **authoritative metadata** (`head`) via the *server-stored
  pathname* — an arbitrary Blob URL can never be injected (AC§1).
- Re-validates that server truth against policy (`validateCompletedBlob`) — the
  client's upload result is never trusted (AC§4).
- **Idempotent:** an already-`ready` row converges to the same asset; duplicate
  completion/callback requests are safe (AC§2).
- **Orphan rollback:** token issued but no bytes (or `pathname` mismatch) → row
  marked `failed`; policy-violating blob → bytes best-effort `deleted` + row
  `failed`. Pending rows carry a 24 h TTL (`expiresAt`) so a sweep can reap
  leftovers (`DEFAULT_PENDING_TTL_HOURS`).
- **Race-safe activation:** the `ready` update guards `ne(status,'deleted')` so a
  concurrent soft-delete cannot be revived.

### 3.3 Access control on the merged surface (AC#2 — partial)

- `GET /files` (`file-list.service.ts#listOwnFiles`) hard-scopes
  `eq(ownerUserId)` and `ne(status,'deleted')` — a caller cannot widen scope or
  see soft-deleted rows.
- `GET /admin/files` is a distinct operator surface; `deleted` hidden unless
  `includeDeleted`.
- `completeUpload` re-checks ownership: unknown id **or** non-owner → identical
  404 (no existence leak).
- `PATCH /files/:id` allow-lists editable fields; moderation `reviewStatus` is
  admin-only (`file-update.dto.ts`).
- All write/edit routes are behind `BetterAuthGuard` (no anonymous edit).

### 3.4 User UI (AC#4 — component level)

`apps/app/src/features/file-upload/file-upload.test.tsx` (7 tests) exercises the
reusable `@repo/ui` uploader: client + server validation errors, progress /
cancel / retry / complete, **auth-modal gating** for the protected action, and
target-resource + policy prop injection. Public pages stay browsable; the upload
action triggers the auth modal rather than a raw error — consistent with the
online-service workflow rule.

## 4. Environment evidence (AC#1)

- `BLOB_READ_WRITE_TOKEN` is declared `optional()` in the server env schema
  (`apps/server/src/config/env.ts`) and present in `.env.example`
  (`.env.example:169`, `apps/server/.env.example:6`).
- `FILE_UPLOAD_PUBLIC_BASE_URL` declared (`apps/server/.env.example:8`) — when
  unset, no completion callback is attached to issued tokens (documented,
  graceful degrade).
- Deploy runbook flags the token as a required function env that needs a
  **redeploy on change** (`docs/runbooks/demo-deploy.md:68`).
- **Not verifiable this run:** whether the token is actually populated in Vercel
  **Development / Preview / Production**. No Vercel CLI or project credentials
  are available in this environment — this is a manual/infra check (see §5).

## 5. Blockers & required actions

**This issue cannot be marked `done`.** AC#2/#3/#4 require capability that is not
on the delivery branch, and AC#1/#4 require Vercel access.

1. **Merge PR #74 (BBR-553, delete/Blob cleanup)** → then re-run QA for: unauthorized
   delete rejection, `POST /admin/files/cleanup` sweep, and the
   "no broken references after delete/cleanup" guarantee.
   _Owner: assignee agent `42edb467`._
2. **Merge PR #92 (BBR-555, admin file-mgmt/audit UI)** → then QA admin file
   management on the deployed URL. _Owner: assignee agent `b10da221`._
3. (Recommended) **Merge PR #71 (BBR-551, read/access URL)** → then QA the
   public/private/owner read access matrix for `GET /files/:id`.
4. **Infra owner:** confirm `BLOB_READ_WRITE_TOKEN` exists in Vercel Dev/Preview/
   Prod (`vercel env ls`) and provide the deployed URL for the manual upload-UI /
   admin-UI smoke in §3.4 / the checklist's Manual section.

Until 1–2 (and ideally 3) land in `main` and 4 is confirmed, the remaining
checklist items in `tests/file-upload/reusable-checklist.md` stay unchecked.
