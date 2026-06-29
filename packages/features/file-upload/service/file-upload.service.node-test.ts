import assert from "node:assert/strict";
import { test } from "node:test";
import { ServiceUnavailableException, UnprocessableEntityException } from "@nestjs/common";
import type { DrizzleDB } from "@repo/drizzle";
import type { CreateUploadInput } from "../dto";
import {
  type ClientTokenIssuer,
  FileUploadService,
  UPLOAD_CALLBACK_PATH,
} from "./file-upload.service";

/** Minimal fake of the drizzle insert().values().returning() chain. */
function fakeDb(): { db: DrizzleDB; inserted: Record<string, unknown>[] } {
  const inserted: Record<string, unknown>[] = [];
  const db = {
    insert() {
      return {
        values(value: Record<string, unknown>) {
          inserted.push(value);
          return {
            returning() {
              return Promise.resolve([{ ...value }]);
            },
          };
        },
      };
    },
  } as unknown as DrizzleDB;
  return { db, inserted };
}

function recordingIssuer(): { issuer: ClientTokenIssuer; calls: Record<string, unknown>[] } {
  const calls: Record<string, unknown>[] = [];
  const issuer: ClientTokenIssuer = (params) => {
    calls.push(params);
    return Promise.resolve("vercel_blob_client_test_token");
  };
  return { issuer, calls };
}

const baseInput: CreateUploadInput = {
  filename: "avatar.png",
  contentType: "image/png",
  size: 4096,
  visibility: "private",
};

const fixedNow = () => new Date("2026-06-29T00:00:00Z");
const fixedId = () => "01HXTESTULID00000000000001";

test("createUpload persists a pending row owned by the caller and returns a draft", async () => {
  const { db, inserted } = fakeDb();
  const { issuer, calls } = recordingIssuer();
  const service = new FileUploadService({
    db,
    issueClientToken: issuer,
    callbackBaseUrl: "https://api.example.com",
    now: fixedNow,
    newId: fixedId,
  });

  const draft = await service.createUpload("user-42", {
    ...baseInput,
    targetType: "profile",
    targetId: "user-42",
  });

  // pending metadata row
  assert.equal(inserted.length, 1);
  const row = inserted[0];
  assert.ok(row);
  assert.equal(row.ownerUserId, "user-42");
  assert.equal(row.source, "user");
  assert.equal(row.status, "pending");
  assert.equal(row.visibility, "private");
  assert.equal(row.declaredContentType, "image/png");
  assert.equal(row.declaredSize, 4096);
  assert.equal(row.targetType, "profile");
  assert.equal(row.originalName, "avatar.png");
  // AC#3: server-generated unguessable pathname; blobUrl provisional == pathname
  assert.equal(row.pathname, "uploads/private/2026/06/01HXTESTULID00000000000001.png");
  assert.equal(row.blobUrl, row.pathname);
  assert.ok(row.expiresAt instanceof Date);

  // draft response
  assert.equal(draft.fileAssetId, "01HXTESTULID00000000000001");
  assert.equal(draft.clientToken, "vercel_blob_client_test_token");
  assert.equal(draft.contentType, "image/png");
  assert.equal(draft.maximumSizeInBytes, 4096);
  assert.equal(draft.pathname, row.pathname);

  // token bound to pathname + content type + size + callback (AC#4)
  assert.equal(calls.length, 1);
  const tokenParams = calls[0];
  assert.ok(tokenParams);
  assert.equal(tokenParams.pathname, row.pathname);
  assert.deepEqual(tokenParams.allowedContentTypes, ["image/png"]);
  assert.equal(tokenParams.maximumSizeInBytes, 4096);
  assert.equal(tokenParams.callbackUrl, `https://api.example.com${UPLOAD_CALLBACK_PATH}`);
  assert.equal(tokenParams.tokenPayload, JSON.stringify({ fileAssetId: draft.fileAssetId }));
  assert.ok((tokenParams.validUntil as number) > fixedNow().getTime());
});

test("omits the callback when no public base URL is configured", async () => {
  const { db } = fakeDb();
  const { issuer, calls } = recordingIssuer();
  const service = new FileUploadService({
    db,
    issueClientToken: issuer,
    now: fixedNow,
    newId: fixedId,
  });

  await service.createUpload("user-1", baseInput);
  assert.equal(calls[0]?.callbackUrl, undefined);
});

test("rejects a policy violation as 422 before persisting or minting", async () => {
  const { db, inserted } = fakeDb();
  const { issuer, calls } = recordingIssuer();
  const service = new FileUploadService({ db, issueClientToken: issuer });

  await assert.rejects(
    () =>
      service.createUpload("user-1", {
        ...baseInput,
        contentType: "image/svg+xml",
        filename: "x.svg",
      }),
    (e: unknown) => e instanceof UnprocessableEntityException,
  );
  assert.equal(inserted.length, 0, "no pending row on policy rejection");
  assert.equal(calls.length, 0, "no token minted on policy rejection");
});

test("maps a token-issuer failure to a friendly 503 (no detail leak)", async () => {
  const { db } = fakeDb();
  const failingIssuer: ClientTokenIssuer = () =>
    Promise.reject(new Error("BLOB_READ_WRITE_TOKEN missing — internal"));
  const service = new FileUploadService({
    db,
    issueClientToken: failingIssuer,
    now: fixedNow,
    newId: fixedId,
  });

  await assert.rejects(
    () => service.createUpload("user-1", baseInput),
    (e: unknown) =>
      e instanceof ServiceUnavailableException &&
      !/BLOB_READ_WRITE_TOKEN/.test((e as Error).message),
  );
});

test("defaults visibility to private when omitted", async () => {
  const { db, inserted } = fakeDb();
  const { issuer } = recordingIssuer();
  const service = new FileUploadService({
    db,
    issueClientToken: issuer,
    now: fixedNow,
    newId: fixedId,
  });

  // visibility intentionally omitted (controller's zod default applies in prod;
  // the service must also be safe on its own).
  const input = {
    filename: "a.pdf",
    contentType: "application/pdf",
    size: 100,
  } as CreateUploadInput;
  const draft = await service.createUpload("user-1", input);
  assert.equal(draft.visibility, "private");
  assert.equal(inserted[0]?.visibility, "private");
});
