import assert from "node:assert/strict";
import test from "node:test";
import {
  fileReviewStatusEnum,
  fileScanStatusEnum,
  fileSourceEnum,
  fileStatusEnum,
  fileVisibilityEnum,
} from "./enums";
import { fileAssets } from "./file-assets";

/**
 * Schema-shape tests for PB-FILE-DATA-001 (BBR-547). These assert the
 * acceptance criteria are encoded in the table/enum definitions — they do not
 * touch a database (drizzle column objects are inspected directly).
 */

const columns = () => fileAssets;

test("AC1: file metadata is more than a Blob URL — owner, target, status, size, MIME, deleted state", () => {
  for (const col of [
    "ownerUserId",
    "targetType",
    "targetId",
    "status",
    "size",
    "contentType",
    "deletedAt",
    "isDeleted",
  ]) {
    assert.equal(col in columns(), true, `missing column: ${col}`);
  }
});

test("AC2: user vs admin/system files are distinguishable via source enum", () => {
  assert.equal("source" in columns(), true);
  assert.deepEqual(fileSourceEnum.enumValues, ["user", "admin", "system"]);
});

test("AC3: server-verified metadata is stored separately from client-declared values", () => {
  // authoritative (server-verified)
  for (const col of ["contentType", "size", "checksum"]) {
    assert.equal(col in columns(), true, `missing server-verified column: ${col}`);
  }
  // untrusted (client-declared)
  for (const col of ["declaredContentType", "declaredSize"]) {
    assert.equal(col in columns(), true, `missing client-declared column: ${col}`);
  }
});

test("AC4: deleted files retain status + deletedAt + deletedBy for audit/cleanup", () => {
  assert.equal("deletedAt" in columns(), true);
  assert.equal("deletedBy" in columns(), true);
  assert.equal(fileStatusEnum.enumValues.includes("deleted"), true);
});

test("visibility defaults to private (public requires whitelist)", () => {
  assert.deepEqual(fileVisibilityEnum.enumValues, ["public", "private"]);
  assert.equal(columns().visibility.default, "private");
});

test("upload lifecycle + scan/review states are enumerated", () => {
  assert.deepEqual(fileStatusEnum.enumValues, ["pending", "ready", "failed", "deleted"]);
  assert.deepEqual(fileScanStatusEnum.enumValues, [
    "pending",
    "clean",
    "infected",
    "error",
    "skipped",
  ]);
  assert.deepEqual(fileReviewStatusEnum.enumValues, [
    "not_required",
    "pending",
    "approved",
    "rejected",
  ]);
  assert.equal(columns().status.default, "pending");
  assert.equal(columns().scanStatus.default, "pending");
  assert.equal(columns().reviewStatus.default, "not_required");
});

test("orphan-cleanup TTL + completion timing columns exist", () => {
  assert.equal("expiresAt" in columns(), true);
  assert.equal("completedAt" in columns(), true);
});

test("blob storage columns are present and pathname/blobUrl are NOT NULL", () => {
  assert.equal(columns().blobUrl.notNull, true);
  assert.equal(columns().pathname.notNull, true);
  assert.equal(columns().originalName.notNull, true);
});
