import assert from "node:assert/strict";
import { test } from "node:test";
import type { DrizzleDB, FileAsset } from "@repo/drizzle";
import { FileDetailService } from "./file-detail.service";

/**
 * Fake of the single-row query builder used by {@link FileDetailService}:
 * `select().from().where().limit()` resolves (thenable) to the supplied rows.
 */
function fakeDb(rows: FileAsset[]) {
  const db = {
    select() {
      const q = {
        from() {
          return q;
        },
        where() {
          return q;
        },
        limit() {
          return q;
        },
        // biome-ignore lint/suspicious/noThenProperty: mirrors drizzle's thenable query builder so it resolves under await.
        then(resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) {
          return Promise.resolve(rows).then(resolve, reject);
        },
      };
      return q;
    },
  } as unknown as DrizzleDB;
  return db;
}

function row(overrides: Partial<FileAsset> = {}): FileAsset {
  return {
    id: "01HXFILE0000000000000000A1",
    createdAt: new Date("2026-06-20T10:00:00Z"),
    updatedAt: new Date("2026-06-20T10:00:00Z"),
    deletedAt: null,
    ownerUserId: "owner-1",
    source: "user",
    targetType: "profile",
    targetId: "owner-1",
    blobUrl: "https://blob.example.com/uploads/a.png",
    pathname: "uploads/a.png",
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

// ---- getAccessibleById ------------------------------------------------------

test("getAccessibleById returns a public view with the servable url to anyone", async () => {
  const svc = new FileDetailService(fakeDb([row({ visibility: "public", status: "ready" })]));
  const view = await svc.getAccessibleById("01HXFILE0000000000000000A1", undefined);

  assert.equal(view.access, "public");
  assert.equal(view.url, "https://blob.example.com/uploads/a.png");
  assert.equal(view.downloadUrl, "https://blob.example.com/dl/a.png");
  // fail-closed: internal columns never appear on the detail view
  const asRecord = view as unknown as Record<string, unknown>;
  assert.ok(!("pathname" in asRecord));
  assert.ok(!("scanStatus" in asRecord));
  assert.ok(!("ownerUserId" in asRecord));
});

test("getAccessibleById returns the owner view to the file owner", async () => {
  const svc = new FileDetailService(
    fakeDb([row({ visibility: "private", ownerUserId: "owner-1" })]),
  );
  const view = await svc.getAccessibleById("01HXFILE0000000000000000A1", { id: "owner-1" });
  assert.equal(view.access, "owner");
  assert.equal(view.url, "https://blob.example.com/uploads/a.png");
});

test("getAccessibleById 404s for an unrelated user (private) — no existence leak", async () => {
  const svc = new FileDetailService(fakeDb([row({ visibility: "private" })]));
  await assert.rejects(
    () => svc.getAccessibleById("01HXFILE0000000000000000A1", { id: "stranger" }),
    /파일을 찾을 수 없습니다/,
  );
});

test("getAccessibleById 404s for a missing id with the same message", async () => {
  const svc = new FileDetailService(fakeDb([]));
  await assert.rejects(
    () => svc.getAccessibleById("01HXFILE0000000000000000A1", { id: "owner-1" }),
    /파일을 찾을 수 없습니다/,
  );
});

test("getAccessibleById withholds the url for an owner's not-yet-ready upload", async () => {
  const svc = new FileDetailService(
    fakeDb([
      row({ visibility: "private", status: "pending", completedAt: null, ownerUserId: "owner-1" }),
    ]),
  );
  const view = await svc.getAccessibleById("01HXFILE0000000000000000A1", { id: "owner-1" });
  assert.equal(view.access, "owner");
  assert.equal(view.url, null);
  assert.equal(view.downloadUrl, null);
});

// ---- getAdminById -----------------------------------------------------------

test("getAdminById returns the full record including soft-deleted rows", async () => {
  const svc = new FileDetailService(fakeDb([row({ status: "deleted", deletedBy: "admin-9" })]));
  const view = await svc.getAdminById("01HXFILE0000000000000000A1");
  assert.equal(view.status, "deleted");
  assert.equal(view.deletedBy, "admin-9");
  assert.equal(view.pathname, "uploads/a.png");
  assert.equal(view.ownerUserId, "owner-1");
});

test("getAdminById 404s for a missing id", async () => {
  const svc = new FileDetailService(fakeDb([]));
  await assert.rejects(
    () => svc.getAdminById("01HXFILE0000000000000000A1"),
    /파일을 찾을 수 없습니다/,
  );
});
