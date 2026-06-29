import assert from "node:assert/strict";
import { test } from "node:test";
import {
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from "@nestjs/common";
import type { DrizzleDB, FileAsset } from "@repo/drizzle";
import type { BlobDeleter, BlobHeadInfo, BlobHeadReader } from "./file-upload.service";
import { FileUploadService } from "./file-upload.service";

const PATHNAME = "uploads/private/2026/06/01HXTESTULID00000000000001.png";

/** Build a file_assets row; only the columns the service reads are meaningful. */
function row(overrides: Partial<FileAsset> = {}): FileAsset {
  return {
    id: "01HXTESTULID00000000000001",
    ownerUserId: "user-42",
    status: "pending",
    pathname: PATHNAME,
    blobUrl: PATHNAME,
    downloadUrl: null,
    contentType: null,
    size: null,
    visibility: "private",
    targetType: "profile",
    targetId: "user-42",
    completedAt: null,
    ...overrides,
  } as unknown as FileAsset;
}

/**
 * Stateful fake of the drizzle select/update chains used by completeUpload.
 * `selectRow` is returned by the id lookup; updates are recorded and applied so
 * the activated row flows back through `.returning()`.
 */
function fakeDb(selectRow: FileAsset | null) {
  let current = selectRow;
  const updates: Record<string, unknown>[] = [];
  const db = {
    select: () => ({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve(current ? [current] : []) }),
      }),
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => {
        updates.push(values);
        const guardFails = !current || current.status === "deleted";
        const applied = guardFails ? null : ({ ...current, ...values } as FileAsset);
        if (applied) current = applied;
        const result = guardFails || !applied ? [] : [applied];
        const promise = Promise.resolve(result);
        return {
          where: () => Object.assign(Promise.resolve(result), { returning: () => promise }),
        };
      },
    }),
  } as unknown as DrizzleDB;
  return { db, updates, current: () => current };
}

function recordingHead(result: BlobHeadInfo | null | (() => never)): {
  reader: BlobHeadReader;
  calls: string[];
} {
  const calls: string[] = [];
  const reader: BlobHeadReader = (pathname) => {
    calls.push(pathname);
    if (typeof result === "function") return Promise.reject(new Error("transient store error"));
    return Promise.resolve(result);
  };
  return { reader, calls };
}

function recordingDeleter(): { deleter: BlobDeleter; calls: string[] } {
  const calls: string[] = [];
  const deleter: BlobDeleter = (pathname) => {
    calls.push(pathname);
    return Promise.resolve();
  };
  return { deleter, calls };
}

const validHead: BlobHeadInfo = {
  url: "https://blob.example.com/uploads/private/2026/06/01HXTESTULID00000000000001.png",
  downloadUrl: "https://blob.example.com/.../download.png",
  pathname: PATHNAME,
  contentType: "image/png",
  size: 4096,
};

const fixedNow = () => new Date("2026-06-29T12:00:00Z");
const issueClientToken = () => Promise.resolve("unused-here");
const input = { fileAssetId: "01HXTESTULID00000000000001" };

function service(opts: { db: DrizzleDB; reader?: BlobHeadReader; deleter?: BlobDeleter }) {
  return new FileUploadService({
    db: opts.db,
    issueClientToken,
    readBlobHead: opts.reader,
    deleteBlob: opts.deleter,
    now: fixedNow,
  });
}

test("completeUpload activates a pending asset from server-verified metadata", async () => {
  const { db, updates } = fakeDb(row());
  const { reader, calls } = recordingHead(validHead);
  const { deleter } = recordingDeleter();
  const svc = service({ db, reader, deleter });

  const result = await svc.completeUpload("user-42", input);

  // AC#1: the store is queried by the SERVER-stored pathname, never client input.
  assert.deepEqual(calls, [PATHNAME]);
  // activation persists server-verified values + ready status (AC: metadata activation)
  assert.equal(updates.length, 1);
  const set = updates[0];
  assert.ok(set);
  assert.equal(set.status, "ready");
  assert.equal(set.blobUrl, validHead.url);
  assert.equal(set.downloadUrl, validHead.downloadUrl);
  assert.equal(set.contentType, "image/png");
  assert.equal(set.size, 4096);
  assert.equal(set.expiresAt, null, "no longer an orphan candidate");
  assert.ok(set.completedAt instanceof Date);
  // response is the activated, server-verified asset
  assert.equal(result.status, "ready");
  assert.equal(result.fileAssetId, input.fileAssetId);
  assert.equal(result.url, validHead.url);
  assert.equal(result.contentType, "image/png");
  assert.equal(result.size, 4096);
  assert.equal(result.visibility, "private");
  assert.equal(result.targetType, "profile");
});

test("completeUpload is idempotent — an already-ready asset returns without re-verifying", async () => {
  const ready = row({
    status: "ready",
    blobUrl: validHead.url,
    downloadUrl: validHead.downloadUrl,
    contentType: "image/png",
    size: 4096,
    completedAt: new Date("2026-06-29T11:00:00Z"),
  });
  const { db, updates } = fakeDb(ready);
  const { reader, calls } = recordingHead(validHead);
  const svc = service({ db, reader });

  const result = await svc.completeUpload("user-42", input);

  // AC#2: duplicate completion converges on the same asset, no store/db churn.
  assert.equal(calls.length, 0, "head not called for an already-ready asset");
  assert.equal(updates.length, 0, "no re-activation write");
  assert.equal(result.status, "ready");
  assert.equal(result.url, validHead.url);
});

test("completeUpload rejects an asset owned by another user as 404 (no existence leak)", async () => {
  const { db, updates } = fakeDb(row({ ownerUserId: "someone-else" }));
  const { reader, calls } = recordingHead(validHead);
  const svc = service({ db, reader });

  await assert.rejects(
    () => svc.completeUpload("user-42", input),
    (e: unknown) => e instanceof NotFoundException,
  );
  assert.equal(calls.length, 0, "authorization re-checked before touching the store (AC#4)");
  assert.equal(updates.length, 0);
});

test("completeUpload returns 404 for an unknown file asset id", async () => {
  const { db } = fakeDb(null);
  const { reader } = recordingHead(validHead);
  const svc = service({ db, reader });

  await assert.rejects(
    () => svc.completeUpload("user-42", input),
    (e: unknown) => e instanceof NotFoundException,
  );
});

test("completeUpload returns 404 for a soft-deleted asset", async () => {
  const { db, updates } = fakeDb(row({ status: "deleted" }));
  const { reader, calls } = recordingHead(validHead);
  const svc = service({ db, reader });

  await assert.rejects(
    () => svc.completeUpload("user-42", input),
    (e: unknown) => e instanceof NotFoundException,
  );
  assert.equal(calls.length, 0);
  assert.equal(updates.length, 0);
});

test("completeUpload marks an orphan (no blob) failed and rejects 422", async () => {
  const { db, updates } = fakeDb(row());
  const { reader } = recordingHead(null); // head -> not found
  const { deleter, calls: delCalls } = recordingDeleter();
  const svc = service({ db, reader, deleter });

  await assert.rejects(
    () => svc.completeUpload("user-42", input),
    (e: unknown) =>
      e instanceof UnprocessableEntityException &&
      (e.getResponse() as { code: string }).code === "upload_not_found",
  );
  // AC#3: orphan rollback — row marked failed; no bytes to delete.
  assert.equal(updates.length, 1);
  assert.equal(updates[0]?.status, "failed");
  assert.equal(delCalls.length, 0);
});

test("completeUpload treats a pathname mismatch as an orphan failure", async () => {
  const { db, updates } = fakeDb(row());
  const { reader } = recordingHead({ ...validHead, pathname: "uploads/private/evil.png" });
  const svc = service({ db, reader, deleter: recordingDeleter().deleter });

  await assert.rejects(
    () => svc.completeUpload("user-42", input),
    (e: unknown) => e instanceof UnprocessableEntityException,
  );
  assert.equal(updates[0]?.status, "failed");
});

test("completeUpload rolls back a policy-violating upload (deletes bytes + marks failed)", async () => {
  const { db, updates } = fakeDb(row());
  // Store reports an oversized blob — must not be activated even though it landed.
  const { reader } = recordingHead({ ...validHead, size: 50 * 1024 * 1024 });
  const { deleter, calls: delCalls } = recordingDeleter();
  const svc = service({ db, reader, deleter });

  await assert.rejects(
    () => svc.completeUpload("user-42", input),
    (e: unknown) => e instanceof UnprocessableEntityException,
  );
  // AC#3/#4: rejected uploads are rolled back — bytes deleted, row marked failed.
  assert.deepEqual(delCalls, [PATHNAME]);
  assert.equal(updates.at(-1)?.status, "failed");
});

test("completeUpload surfaces a transient store error as 503 without marking failed", async () => {
  const { db, updates } = fakeDb(row());
  const { reader } = recordingHead(() => {
    throw new Error("boom");
  });
  const svc = service({ db, reader, deleter: recordingDeleter().deleter });

  await assert.rejects(
    () => svc.completeUpload("user-42", input),
    (e: unknown) => e instanceof ServiceUnavailableException,
  );
  // Transient failure is retryable — the pending row is left untouched.
  assert.equal(updates.length, 0);
});

test("completeUpload returns 503 when the blob reader is not configured", async () => {
  const { db } = fakeDb(row());
  const svc = service({ db }); // no readBlobHead

  await assert.rejects(
    () => svc.completeUpload("user-42", input),
    (e: unknown) => e instanceof ServiceUnavailableException,
  );
});
