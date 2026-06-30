import assert from "node:assert/strict";
import { test } from "node:test";
import {
  type FileMetadataCurrent,
  resolveMetadataUpdate,
} from "./file-metadata-policy";

function current(overrides: Partial<FileMetadataCurrent> = {}): FileMetadataCurrent {
  return {
    status: "ready",
    visibility: "private",
    reviewStatus: "not_required",
    targetType: "profile",
    targetId: "user-1",
    originalName: "a.png",
    altText: null,
    sortOrder: 0,
    ...overrides,
  };
}

// ---- AC §1: metadata only, binary untouched ---------------------------------

test("collects only the changed metadata fields (idempotent no-op → empty)", () => {
  const res = resolveMetadataUpdate(
    current(),
    { originalName: "a.png", sortOrder: 0, altText: null },
    { role: "owner" },
  );
  assert.ok(res.ok);
  assert.deepEqual(res.changes, {}, "patch equal to current produces no changes");
});

test("maps display name + alt text + sort order to column changes", () => {
  const res = resolveMetadataUpdate(
    current(),
    { originalName: "profile.png", altText: "내 프로필 사진", sortOrder: 3 },
    { role: "owner" },
  );
  assert.ok(res.ok);
  assert.deepEqual(res.changes, {
    originalName: "profile.png",
    altText: "내 프로필 사진",
    sortOrder: 3,
  });
});

// ---- review status is admin-only --------------------------------------------

test("owner cannot change review status; admin can", () => {
  const asOwner = resolveMetadataUpdate(
    current(),
    { reviewStatus: "approved" },
    { role: "owner" },
  );
  assert.ok(asOwner.ok);
  assert.equal("reviewStatus" in asOwner.changes, false);

  const asAdmin = resolveMetadataUpdate(
    current(),
    { reviewStatus: "approved" },
    { role: "admin" },
  );
  assert.ok(asAdmin.ok);
  assert.equal(asAdmin.changes.reviewStatus, "approved");
});

// ---- AC §2: visibility → public gate ----------------------------------------

test("public is rejected when the upload is not ready", () => {
  const res = resolveMetadataUpdate(
    current({ status: "pending" }),
    { visibility: "public" },
    { role: "owner" },
  );
  assert.equal(res.ok, false);
  assert.equal(res.ok === false && res.violation.code, "not_ready_for_public");
});

test("public is rejected when review is pending or rejected", () => {
  for (const reviewStatus of ["pending", "rejected"] as const) {
    const res = resolveMetadataUpdate(
      current({ reviewStatus }),
      { visibility: "public" },
      { role: "owner" },
    );
    assert.equal(res.ok, false);
    assert.equal(res.ok === false && res.violation.code, "review_blocks_public");
  }
});

test("public is allowed for a ready + approved asset", () => {
  const res = resolveMetadataUpdate(
    current({ reviewStatus: "approved" }),
    { visibility: "public" },
    { role: "owner" },
  );
  assert.ok(res.ok);
  assert.equal(res.changes.visibility, "public");
});

test("admin may approve + publish in a single patch (resulting review evaluated)", () => {
  const res = resolveMetadataUpdate(
    current({ reviewStatus: "pending" }),
    { reviewStatus: "approved", visibility: "public" },
    { role: "admin" },
  );
  assert.ok(res.ok);
  assert.equal(res.changes.visibility, "public");
  assert.equal(res.changes.reviewStatus, "approved");
});

// ---- target coherence -------------------------------------------------------

test("detaching the target requires clearing both type and id", () => {
  const incomplete = resolveMetadataUpdate(
    current(),
    { targetType: null },
    { role: "owner" },
  );
  assert.equal(incomplete.ok, false);
  assert.equal(incomplete.ok === false && incomplete.violation.code, "incomplete_target");

  const both = resolveMetadataUpdate(
    current(),
    { targetType: null, targetId: null },
    { role: "owner" },
  );
  assert.ok(both.ok);
  assert.equal(both.changes.targetType, null);
  assert.equal(both.changes.targetId, null);
});

// ---- soft-deleted assets are immutable --------------------------------------

test("a deleted asset cannot be edited", () => {
  const res = resolveMetadataUpdate(
    current({ status: "deleted" }),
    { originalName: "x.png" },
    { role: "admin" },
  );
  assert.equal(res.ok, false);
  assert.equal(res.ok === false && res.violation.code, "file_deleted");
});
