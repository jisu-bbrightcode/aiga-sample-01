import assert from "node:assert/strict";
import { test } from "node:test";
import { NotFoundException } from "@nestjs/common";
import type { DrizzleDB, FileAsset } from "@repo/drizzle";
import { type FileAuditLogger, FileDeleteService } from "./file-delete.service";
import type { BlobDeleter } from "./file-upload.service";

const PATHNAME = "uploads/private/2026/06/01HXTESTULID00000000000001.png";

function row(overrides: Partial<FileAsset> = {}): FileAsset {
  return {
    id: "01HXTESTULID00000000000001",
    ownerUserId: "user-42",
    status: "ready",
    pathname: PATHNAME,
    blobUrl: PATHNAME,
    deletedAt: null,
    deletedBy: null,
    expiresAt: null,
    ...overrides,
  } as unknown as FileAsset;
}

/**
 * Stateful fake of the drizzle select/update chains used by the delete service.
 * `selects` is a queue: each `select()...limit()` resolves the next array. Update
 * `.returning()` echoes the most recently selected row merged with the `set`
 * values, so the soft-deleted row flows back into the blob purge. Every `set`
 * payload is recorded for assertions.
 */
function fakeDb(selects: FileAsset[][]) {
  const queue = [...selects];
  const updates: Record<string, unknown>[] = [];
  let current: FileAsset | null = null;

  const db = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => {
            const rows = queue.shift() ?? [];
            if (rows[0]) current = rows[0];
            return Promise.resolve(rows);
          },
        }),
      }),
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => {
        updates.push(values);
        const merged = [{ ...(current ?? {}), ...values } as FileAsset];
        return {
          where: () =>
            Object.assign(Promise.resolve(merged), { returning: () => Promise.resolve(merged) }),
        };
      },
    }),
  } as unknown as DrizzleDB;

  return { db, updates };
}

function recordingDeleter(fail = false): { deleter: BlobDeleter; calls: string[] } {
  const calls: string[] = [];
  const deleter: BlobDeleter = (pathname) => {
    calls.push(pathname);
    return fail ? Promise.reject(new Error("blob store down")) : Promise.resolve();
  };
  return { deleter, calls };
}

function recordingAudit(): { audit: FileAuditLogger; entries: Parameters<FileAuditLogger>[0][] } {
  const entries: Parameters<FileAuditLogger>[0][] = [];
  const audit: FileAuditLogger = (entry) => {
    entries.push(entry);
    return Promise.resolve();
  };
  return { audit, entries };
}

const fixedNow = () => new Date("2026-06-30T12:00:00Z");

// ---- owner delete (AC §1) ---------------------------------------------------

test("deleteOwn soft-deletes the row first, then purges the blob (AC §2 ordering)", async () => {
  const { db, updates } = fakeDb([[row()]]);
  const { deleter, calls } = recordingDeleter();
  const { audit, entries } = recordingAudit();
  const svc = new FileDeleteService({ db, deleteBlob: deleter, audit, now: fixedNow });

  const result = await svc.deleteOwn("user-42", "01HXTESTULID00000000000001");

  // DB soft-delete first: status + audit columns + blob-cleanup marker set.
  const del = updates[0];
  assert.equal(del?.status, "deleted");
  assert.equal(del?.isDeleted, true);
  assert.equal(del?.deletedBy, "user-42");
  assert.ok(del?.deletedAt instanceof Date);
  assert.ok(del?.expiresAt instanceof Date, "expiresAt set as the blob-purge marker");
  // Then the blob bytes are reclaimed and the marker cleared.
  assert.deepEqual(calls, [PATHNAME]);
  assert.equal(updates[1]?.expiresAt, null, "marker cleared after a successful purge");
  // Owner self-delete is audited via the column trail (no admin_audit row needed).
  assert.equal(entries[0]?.action, "file.deleted");
  assert.equal(result.status, "deleted");
  assert.equal(result.fileAssetId, "01HXTESTULID00000000000001");
});

test("deleteOwn rejects another user's file as 404 without touching it (AC §1)", async () => {
  const { db, updates } = fakeDb([[row({ ownerUserId: "someone-else" })]]);
  const { deleter, calls } = recordingDeleter();
  const svc = new FileDeleteService({ db, deleteBlob: deleter, now: fixedNow });

  await assert.rejects(
    () => svc.deleteOwn("user-42", "01HXTESTULID00000000000001"),
    (e: unknown) => e instanceof NotFoundException,
  );
  assert.equal(updates.length, 0, "no soft-delete write for a non-owner");
  assert.equal(calls.length, 0, "no blob deletion for a non-owner");
});

test("deleteOwn returns 404 for an unknown id (no existence leak)", async () => {
  const { db } = fakeDb([[]]);
  const svc = new FileDeleteService({ db, now: fixedNow });
  await assert.rejects(
    () => svc.deleteOwn("user-42", "missing"),
    (e: unknown) => e instanceof NotFoundException,
  );
});

test("deleteOwn is idempotent — an already-deleted row does not re-purge or re-audit", async () => {
  const deletedAt = new Date("2026-06-29T09:00:00Z");
  const { db, updates } = fakeDb([[row({ status: "deleted", deletedAt })]]);
  const { deleter, calls } = recordingDeleter();
  const { audit, entries } = recordingAudit();
  const svc = new FileDeleteService({ db, deleteBlob: deleter, audit, now: fixedNow });

  const result = await svc.deleteOwn("user-42", "01HXTESTULID00000000000001");

  assert.equal(updates.length, 0);
  assert.equal(calls.length, 0);
  assert.equal(entries.length, 0);
  assert.equal(result.deletedAt, deletedAt.toISOString(), "original deletion time preserved");
});

test("deleteOwn keeps the soft-delete even when the blob purge fails (AC §2 compensation)", async () => {
  const { db, updates } = fakeDb([[row()]]);
  const { deleter, calls } = recordingDeleter(true); // blob delete throws
  const svc = new FileDeleteService({ db, deleteBlob: deleter, now: fixedNow });

  const result = await svc.deleteOwn("user-42", "01HXTESTULID00000000000001");

  // Soft-delete persisted; blob purge attempted but failed → marker left for the sweep.
  assert.equal(updates[0]?.status, "deleted");
  assert.deepEqual(calls, [PATHNAME]);
  assert.equal(updates.length, 1, "no marker-clearing update after a failed purge");
  assert.equal(result.status, "deleted");
});

// ---- admin force delete -----------------------------------------------------

test("forceDelete removes any owner's file and writes an admin audit entry", async () => {
  const { db, updates } = fakeDb([[row({ ownerUserId: "victim" })]]);
  const { deleter, calls } = recordingDeleter();
  const { audit, entries } = recordingAudit();
  const svc = new FileDeleteService({ db, deleteBlob: deleter, audit, now: fixedNow });

  const result = await svc.forceDelete("admin-1", "01HXTESTULID00000000000001");

  assert.equal(updates[0]?.status, "deleted");
  assert.equal(updates[0]?.deletedBy, "admin-1");
  assert.deepEqual(calls, [PATHNAME]);
  assert.equal(entries[0]?.action, "file.force_deleted");
  assert.equal(entries[0]?.targetId, "01HXTESTULID00000000000001");
  assert.equal(result.status, "deleted");
});

test("forceDelete returns 404 for an unknown id", async () => {
  const { db } = fakeDb([[]]);
  const svc = new FileDeleteService({ db, now: fixedNow });
  await assert.rejects(
    () => svc.forceDelete("admin-1", "missing"),
    (e: unknown) => e instanceof NotFoundException,
  );
});

// ---- cleanup sweep (AC §3) --------------------------------------------------

test("sweep reaps expired pending orphans and retries stuck deleted-row purges", async () => {
  const orphan = row({ id: "orphan-1", status: "pending", expiresAt: new Date("2026-06-01") });
  const stuck = row({ id: "stuck-1", status: "deleted", expiresAt: new Date("2026-06-01") });
  // select #1 → orphan pending; select #2 → stuck deleted rows.
  const { db, updates } = fakeDb([[orphan], [stuck]]);
  const { deleter, calls } = recordingDeleter();
  const svc = new FileDeleteService({ db, deleteBlob: deleter, now: fixedNow });

  const result = await svc.sweep({ limit: 50 });

  assert.equal(result.orphanPendingReaped, 1);
  assert.equal(result.deletedBlobsPurged, 1);
  assert.equal(result.blobDeleteFailures, 0);
  // Orphan → marked failed; stuck deleted → marker cleared after purge.
  assert.equal(updates[0]?.status, "failed");
  assert.equal(updates[0]?.expiresAt, null);
  assert.equal(updates[1]?.expiresAt, null);
  assert.deepEqual(calls.sort(), [PATHNAME, PATHNAME].sort());
});

test("sweep counts a still-failing deleted-row purge as a failure (retried next pass)", async () => {
  const stuck = row({ id: "stuck-1", status: "deleted", expiresAt: new Date("2026-06-01") });
  const { db, updates } = fakeDb([[], [stuck]]); // no orphans; one stuck row
  const { deleter } = recordingDeleter(true); // purge fails again
  const svc = new FileDeleteService({ db, deleteBlob: deleter, now: fixedNow });

  const result = await svc.sweep();

  assert.equal(result.orphanPendingReaped, 0);
  assert.equal(result.deletedBlobsPurged, 0);
  assert.equal(result.blobDeleteFailures, 1);
  assert.equal(updates.length, 0, "no marker cleared while the purge keeps failing");
});
