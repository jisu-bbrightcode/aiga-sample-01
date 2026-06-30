# File Delete & Blob Cleanup Operations (PB-FILE-API-DELETE-001 / BBR-553)

Operational reference for deleting file assets and reclaiming Vercel Blob
storage. EXTENDs the file-upload capability (`packages/features/file-upload`)
with the delete + storage-reclaim lifecycle on top of create/complete/list.

## Endpoints

| Method & path | Guard | Purpose |
|---|---|---|
| `DELETE /files/:id` | `BetterAuthGuard` (owner) | Owner soft-deletes their own file. |
| `DELETE /admin/files/:id` | `BetterAuthAdminGuard` | Operator force-deletes any file (audited). |
| `POST /admin/files/cleanup` | `BetterAuthAdminGuard` | Runs one cleanup sweep (orphan + stuck-purge). |

All three return `200`. Delete responses are
`{ fileAssetId, status: "deleted", deletedAt }`; the cleanup response is
`{ orphanPendingReaped, deletedBlobsPurged, blobDeleteFailures }`.

## Soft delete & compensation policy (AC §2)

Deletion is a **soft delete**, never a hard row removal. `FileDeleteService`
runs a two-step compensation:

1. **DB metadata first.** The row is flipped to `status="deleted"` and stamped
   with `isDeleted=true`, `deletedAt`, `deletedBy`. Because every read path
   (`GET /files`, `GET /admin/files`, detail, domain references) filters on
   `status != "deleted"`, the file disappears from all surfaces immediately — a
   half-finished delete can never leave a dangling reference (AC §4).
2. **Blob bytes second, best-effort.** Before the byte delete, `expiresAt` is
   set as a "blob still needs purging" marker. The blob `del()` is then
   attempted:
   - **success** → the marker is cleared (`expiresAt = null`); the asset is
     fully reclaimed.
   - **failure** → the marker is left set. The DB delete still stands (the store
     is never the source of truth), so the only consequence is leaked bytes,
     which the cleanup sweep reclaims later.

Deletes are **idempotent**: re-deleting an already-deleted row returns the
original `deletedAt` without re-touching the blob or re-auditing.

## Authorization (AC §1)

Owner scope is taken from the authenticated session and re-checked against the
row. An unknown id and another user's file both resolve to the same `404`, so a
caller can neither delete nor probe for files outside their scope. Admin force
delete bypasses the owner check but requires the admin role.

## Audit log

- Every delete stamps `deleted_by` / `deleted_at` on `file_assets` (column-level
  trail, always written).
- Admin **force** deletes additionally append an `admin_audit_log` row
  (`action = "file.force_deleted"`, `targetType = "file"`) — a privileged
  cross-owner mutation. Owner self-deletes use `action = "file.deleted"`.

## Cleanup sweep — the operations task (AC §3)

`FileDeleteService.sweep({ limit })` runs two bounded passes (default/​max limit
100/1000 rows per pass):

1. **Orphan pending reap.** `status="pending"` rows past `expiresAt` — a token
   was issued but the client upload never completed. Best-effort blob delete,
   then mark `failed`. These are set up at create time with a 24h pending TTL.
2. **Stuck-purge retry.** `status="deleted"` rows whose `expiresAt` marker is
   still set (step 2 above failed). Retry the blob `del()`; clear the marker on
   success, otherwise count it as a failure and leave it for the next pass.

The sweep is idempotent and safe to schedule. Trigger it via
`POST /admin/files/cleanup`, or wire it to a scheduled job (Vercel Cron / queue
worker) calling the same service method.

### Suggested schedule

| Job | Cadence | Notes |
|---|---|---|
| `POST /admin/files/cleanup` | every 15–30 min | Bounded by `limit`; loop or raise `limit` if backlog persists. |

`blobDeleteFailures > 0` across consecutive runs indicates a persistent store
issue (e.g. an invalid `BLOB_READ_WRITE_TOKEN`) — the rows stay safely
soft-deleted and queued until it recovers.

## Environment

- `BLOB_READ_WRITE_TOKEN` — Vercel Blob read/write token used for `del()`. When
  unset, deletes still soft-delete the metadata (DB-only); blob bytes are simply
  not purged and the marker stays for a future sweep once the token is set.

## No migration

All columns used (`status` enum incl. `deleted`, `is_deleted`, `deleted_at`,
`deleted_by`, `expires_at`) already exist on `file_assets`
(migration `0050_file_assets.sql`). This task adds no schema change.
