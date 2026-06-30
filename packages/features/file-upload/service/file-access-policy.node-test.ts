import assert from "node:assert/strict";
import { test } from "node:test";
import type { FileAsset } from "@repo/drizzle";
import { resolveFileDetailAccess } from "./file-access-policy";

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

// ---- public access (AC §1) --------------------------------------------------

test("public + ready file is world-readable, even anonymously", () => {
  const r = row({ visibility: "public", status: "ready", ownerUserId: "someone-else" });
  assert.equal(resolveFileDetailAccess(r, undefined), "public");
  assert.equal(resolveFileDetailAccess(r, { id: "random" }), "public");
});

test("public file that is not yet ready is not public to anonymous callers", () => {
  const r = row({ visibility: "public", status: "pending", ownerUserId: "owner-1" });
  // anonymous → denied (nothing servable, and must not leak existence)
  assert.equal(resolveFileDetailAccess(r, undefined), "denied");
  // but the owner still resolves their own pending upload
  assert.equal(resolveFileDetailAccess(r, { id: "owner-1" }), "owner");
});

// ---- private access (AC §2, §3) ---------------------------------------------

test("private file is denied to anonymous and to unrelated users (no existence leak)", () => {
  const r = row({ visibility: "private", status: "ready" });
  assert.equal(resolveFileDetailAccess(r, undefined), "denied");
  assert.equal(resolveFileDetailAccess(r, { id: "stranger" }), "denied");
});

test("private file is released to the file owner", () => {
  const r = row({
    visibility: "private",
    ownerUserId: "owner-1",
    targetType: null,
    targetId: null,
  });
  assert.equal(resolveFileDetailAccess(r, { id: "owner-1" }), "owner");
});

test("private file is released to the owner of the attached domain resource (§3)", () => {
  // Uploaded by an admin, but attached to user-7's profile → user-7 may read it.
  const r = row({
    visibility: "private",
    source: "admin",
    ownerUserId: "admin-9",
    targetType: "profile",
    targetId: "user-7",
  });
  assert.equal(resolveFileDetailAccess(r, { id: "user-7" }), "owner");
  // someone who owns neither the file nor the resource is still denied
  assert.equal(resolveFileDetailAccess(r, { id: "user-8" }), "denied");
});

test("target-resource ownership only applies to self-owned target kinds", () => {
  // hospital target: matching id must NOT grant access (no in-feature resolver)
  const r = row({
    visibility: "private",
    ownerUserId: "owner-1",
    targetType: "hospital",
    targetId: "viewer-2",
  });
  assert.equal(resolveFileDetailAccess(r, { id: "viewer-2" }), "denied");
});

// ---- soft-delete ------------------------------------------------------------

test("soft-deleted file is denied on the public/owner surface, even to its owner", () => {
  const r = row({ status: "deleted", visibility: "public", ownerUserId: "owner-1" });
  assert.equal(resolveFileDetailAccess(r, undefined), "denied");
  assert.equal(resolveFileDetailAccess(r, { id: "owner-1" }), "denied");
});
