import assert from "node:assert/strict";
import { test } from "node:test";
import type { DrizzleDB, FileAsset } from "@repo/drizzle";
import { FileListService } from "./file-list.service";
import { toAdminFileView, toOwnerFileView } from "./file-list-mappers";

/**
 * Capturing fake of the drizzle query builder. Both the windowed-rows query
 * (`select().from().where().orderBy().limit().offset()`) and the count query
 * (`select({value}).from().where()`) are thenable so they resolve under
 * `Promise.all`. Records the `where` predicate + limit/offset for assertions.
 */
function fakeDb(rows: FileAsset[], total: number) {
  const calls: { isCount: boolean; where: unknown }[] = [];
  const captured: { limit?: number; offset?: number } = {};

  const db = {
    select(projection?: Record<string, unknown>) {
      const isCount = !!projection && "value" in projection;
      const q = {
        from() {
          return q;
        },
        where(w: unknown) {
          calls.push({ isCount, where: w });
          return q;
        },
        orderBy() {
          return q;
        },
        limit(l: number) {
          captured.limit = l;
          return q;
        },
        offset(o: number) {
          captured.offset = o;
          return q;
        },
        // biome-ignore lint/suspicious/noThenProperty: drizzle's query builder is itself a thenable resolved by await/Promise.all; this fake mirrors it.
        then(resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) {
          const result = isCount ? [{ value: total }] : rows;
          return Promise.resolve(result).then(resolve, reject);
        },
      };
      return q;
    },
  } as unknown as DrizzleDB;

  return { db, calls, captured };
}

function row(overrides: Partial<FileAsset> = {}): FileAsset {
  return {
    id: "01HXFILE0000000000000000A1",
    createdAt: new Date("2026-06-20T10:00:00Z"),
    updatedAt: new Date("2026-06-20T10:00:00Z"),
    deletedAt: null,
    ownerUserId: "user-1",
    source: "user",
    targetType: "profile",
    targetId: "user-1",
    blobUrl: "https://blob.example.com/uploads/private/2026/06/a.png",
    pathname: "uploads/private/2026/06/a.png",
    downloadUrl: "https://blob.example.com/dl/a.png",
    originalName: "a.png",
    visibility: "private",
    status: "ready",
    contentType: "image/png",
    size: 1234,
    checksum: null,
    checksumAlgorithm: null,
    declaredContentType: "image/png",
    declaredSize: 1234,
    scanStatus: "clean",
    scannedAt: null,
    reviewStatus: "not_required",
    completedAt: new Date("2026-06-20T10:05:00Z"),
    expiresAt: null,
    deletedBy: null,
    ...overrides,
  } as FileAsset;
}

// ---- owner listing (AC §1) --------------------------------------------------

test("listOwnFiles scopes to the caller, excludes deleted, and paginates", async () => {
  const { db, calls, captured } = fakeDb([row()], 1);
  const service = new FileListService(db);

  const result = await service.listOwnFiles("user-1", { page: 2, limit: 10 });

  // page 2 of size 10 → offset 10
  assert.equal(captured.limit, 10);
  assert.equal(captured.offset, 10);
  assert.equal(result.total, 1);
  assert.equal(result.page, 2);
  assert.equal(result.limit, 10);
  assert.equal(result.items.length, 1);

  // Owner scope + deleted-exclusion are always applied → both queries carry a
  // predicate, and the rows + count queries share the same one (consistent total).
  assert.equal(calls.length, 2);
  for (const c of calls) assert.ok(c.where, "every query must carry the owner/deleted predicate");
  assert.equal(calls[0]?.where, calls[1]?.where);
});

test("listOwnFiles maps to the owner view (no internal/storage fields leak)", async () => {
  const { db } = fakeDb([row()], 1);
  const service = new FileListService(db);

  const { items } = await service.listOwnFiles("user-1", { page: 1, limit: 20 });
  const item = items[0] as unknown as Record<string, unknown>;

  assert.equal(item.fileAssetId, "01HXFILE0000000000000000A1");
  assert.equal(item.url, "https://blob.example.com/uploads/private/2026/06/a.png");
  // AC §3 / fail-closed: owner view never exposes operator-only columns.
  assert.ok(!("pathname" in item));
  assert.ok(!("scanStatus" in item));
  assert.ok(!("reviewStatus" in item));
  assert.ok(!("declaredContentType" in item));
  assert.ok(!("ownerUserId" in item));
  assert.ok(!("deletedBy" in item));
});

// ---- admin listing (AC §2, §3) ----------------------------------------------

test("listAdminFiles hides deleted by default but includes them on request", async () => {
  // default: includeDeleted=false, no status filter → predicate present (ne deleted)
  {
    const { db, calls } = fakeDb([], 0);
    const service = new FileListService(db);
    await service.listAdminFiles({ page: 1, limit: 20, includeDeleted: false });
    for (const c of calls) assert.ok(c.where, "default admin listing must exclude deleted rows");
  }
  // includeDeleted=true with no other filters → no predicate (deleted rows shown)
  {
    const { db, calls } = fakeDb([], 0);
    const service = new FileListService(db);
    await service.listAdminFiles({ page: 1, limit: 20, includeDeleted: true });
    for (const c of calls)
      assert.equal(c.where, undefined, "includeDeleted must not constrain status");
  }
});

test("listAdminFiles maps to the full admin view (owner/target/audit fields)", async () => {
  const { db } = fakeDb([row({ status: "deleted", deletedBy: "admin-9" })], 1);
  const service = new FileListService(db);

  const { items } = await service.listAdminFiles({ page: 1, limit: 20, includeDeleted: true });
  const item = items[0] as unknown as Record<string, unknown>;

  assert.equal(item.ownerUserId, "user-1");
  assert.equal(item.pathname, "uploads/private/2026/06/a.png");
  assert.equal(item.scanStatus, "clean");
  assert.equal(item.reviewStatus, "not_required");
  assert.equal(item.declaredContentType, "image/png");
  assert.equal(item.status, "deleted");
  assert.equal(item.deletedBy, "admin-9");
});

// ---- mappers (pure) ---------------------------------------------------------

test("toOwnerFileView withholds the url until the asset is ready", () => {
  const pending = toOwnerFileView(row({ status: "pending", completedAt: null }));
  assert.equal(pending.url, null);
  assert.equal(pending.downloadUrl, null);
  assert.equal(pending.completedAt, null);

  const ready = toOwnerFileView(row());
  assert.equal(ready.url, "https://blob.example.com/uploads/private/2026/06/a.png");
  assert.equal(ready.downloadUrl, "https://blob.example.com/dl/a.png");
});

test("toAdminFileView exposes the canonical url even for non-ready rows", () => {
  const failed = toAdminFileView(row({ status: "failed" }));
  assert.equal(failed.url, "https://blob.example.com/uploads/private/2026/06/a.png");
  assert.equal(failed.status, "failed");
});
