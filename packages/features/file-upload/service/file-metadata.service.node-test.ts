import assert from "node:assert/strict";
import { test } from "node:test";
import type { DrizzleDB, FileAsset } from "@repo/drizzle";
import {
  type FileAuditLogger,
  FileMetadataAuditAction,
  FileMetadataService,
} from "./file-metadata.service";

interface AuditCall {
  actorUserId: string;
  action: string;
  targetId?: string;
  payloadBefore?: unknown;
  payloadAfter?: unknown;
  reason?: string;
}

/**
 * Fake drizzle: `select().from().where().limit()` resolves to the seeded row,
 * and `update().set().where().returning()` records the patch and returns the
 * row merged with it. Both chains are thenable where needed.
 */
function fakeDb(seed: FileAsset | undefined) {
  const recorded: { setValues?: Record<string, unknown> } = {};
  let current = seed;

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
          return Promise.resolve(current ? [current] : []);
        },
      };
      return q;
    },
    update() {
      const q = {
        set(values: Record<string, unknown>) {
          recorded.setValues = values;
          if (current) current = { ...current, ...values } as FileAsset;
          return q;
        },
        where() {
          return q;
        },
        returning() {
          return Promise.resolve(current ? [current] : []);
        },
      };
      return q;
    },
  } as unknown as DrizzleDB;

  return { db, recorded };
}

function fakeAudit() {
  const calls: AuditCall[] = [];
  const audit: FileAuditLogger = {
    log(entry) {
      calls.push(entry);
      return Promise.resolve();
    },
  };
  return { audit, calls };
}

function row(overrides: Partial<FileAsset> = {}): FileAsset {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    createdAt: new Date("2026-06-20T10:00:00Z"),
    updatedAt: new Date("2026-06-20T10:00:00Z"),
    deletedAt: null,
    isDeleted: false,
    ownerUserId: "user-1",
    source: "user",
    targetType: "profile",
    targetId: "user-1",
    blobUrl: "https://blob.example.com/uploads/a.png",
    pathname: "uploads/a.png",
    downloadUrl: null,
    originalName: "a.png",
    altText: null,
    sortOrder: 0,
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

// ---- owner happy path -------------------------------------------------------

test("updateOwnFile persists changes, never touches the binary, audits as owner", async () => {
  const { db, recorded } = fakeDb(row());
  const { audit, calls } = fakeAudit();
  const service = new FileMetadataService(db, audit);

  const view = await service.updateOwnFile("user-1", row().id, {
    displayName: "profile.png",
    altText: "프로필",
    sortOrder: 2,
  });

  // only metadata columns were written — no blobUrl/pathname/contentType/status
  assert.deepEqual(recorded.setValues, {
    originalName: "profile.png",
    altText: "프로필",
    sortOrder: 2,
  });
  assert.equal(view.displayName, "profile.png");
  assert.equal(view.altText, "프로필");

  // AC §3: owner action string + before/after diff
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.action, FileMetadataAuditAction.ownerUpdated);
  assert.equal(calls[0]?.actorUserId, "user-1");
  assert.deepEqual(calls[0]?.payloadBefore, {
    originalName: "a.png",
    altText: null,
    sortOrder: 0,
  });
});

test("updateOwnFile is idempotent — a no-op patch writes nothing and does not audit", async () => {
  const { db, recorded } = fakeDb(row());
  const { audit, calls } = fakeAudit();
  const service = new FileMetadataService(db, audit);

  const view = await service.updateOwnFile("user-1", row().id, { displayName: "a.png", sortOrder: 0 });

  assert.equal(recorded.setValues, undefined, "no update issued");
  assert.equal(calls.length, 0, "no audit row");
  assert.equal(view.displayName, "a.png");
});

test("updateOwnFile 404s when the row is missing / not owned (no leak)", async () => {
  const { db } = fakeDb(undefined);
  const { audit } = fakeAudit();
  const service = new FileMetadataService(db, audit);

  await assert.rejects(
    () => service.updateOwnFile("user-1", row().id, { displayName: "x.png" }),
    /파일을 찾을 수 없습니다/,
  );
});

// ---- visibility gate (AC §2) ------------------------------------------------

test("updateOwnFile rejects public when review is pending (422)", async () => {
  const { db, recorded } = fakeDb(row({ reviewStatus: "pending" }));
  const { audit, calls } = fakeAudit();
  const service = new FileMetadataService(db, audit);

  await assert.rejects(
    () => service.updateOwnFile("user-1", row().id, { visibility: "public" }),
    (err: { status?: number }) => err.status === 422,
  );
  assert.equal(recorded.setValues, undefined);
  assert.equal(calls.length, 0);
});

// ---- admin path (AC §3) -----------------------------------------------------

test("updateFileAsAdmin can set review status and audits with the admin action", async () => {
  const { db, recorded } = fakeDb(row({ ownerUserId: "someone-else" }));
  const { audit, calls } = fakeAudit();
  const service = new FileMetadataService(db, audit);

  const view = await service.updateFileAsAdmin("admin-9", row().id, {
    reviewStatus: "approved",
    visibility: "public",
  });

  assert.deepEqual(recorded.setValues, { reviewStatus: "approved", visibility: "public" });
  assert.equal(view.reviewStatus, "approved");
  assert.equal(view.visibility, "public");
  assert.equal(calls[0]?.action, FileMetadataAuditAction.adminUpdated);
  assert.equal(calls[0]?.actorUserId, "admin-9");
});

test("updateFileAsAdmin 409s on a soft-deleted asset", async () => {
  const { db } = fakeDb(row({ status: "deleted" }));
  const { audit } = fakeAudit();
  const service = new FileMetadataService(db, audit);

  await assert.rejects(
    () => service.updateFileAsAdmin("admin-9", row().id, { displayName: "x.png" }),
    (err: { status?: number }) => err.status === 409,
  );
});
