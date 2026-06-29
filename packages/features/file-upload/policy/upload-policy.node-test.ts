import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildBlobPathname,
  DEFAULT_MAX_UPLOAD_BYTES,
  UploadPolicyError,
  validateUploadRequest,
} from "./upload-policy";

// ---- AC#2: allowed types pass -------------------------------------------------

test("accepts allowed image and pdf types, normalizing content type", () => {
  const png = validateUploadRequest({
    filename: "photo.PNG",
    contentType: "image/png",
    size: 1024,
  });
  assert.equal(png.contentType, "image/png");
  assert.equal(png.extension, "png");
  assert.equal(png.size, 1024);

  const jpg = validateUploadRequest({
    filename: "a.jpg",
    contentType: "IMAGE/JPEG; charset=binary",
    size: 2048,
  });
  assert.equal(jpg.contentType, "image/jpeg");

  const pdf = validateUploadRequest({
    filename: "doc.pdf",
    contentType: "application/pdf",
    size: 5,
  });
  assert.equal(pdf.extension, "pdf");
});

// ---- AC#2: disallowed MIME / extension / size are rejected --------------------

test("rejects disallowed MIME types (incl. svg/exe/script)", () => {
  for (const contentType of [
    "image/svg+xml",
    "application/x-msdownload",
    "text/html",
    "application/javascript",
    "application/zip",
  ]) {
    assert.throws(
      () => validateUploadRequest({ filename: "x.png", contentType, size: 10 }),
      (e: unknown) => e instanceof UploadPolicyError && e.code === "unsupported_content_type",
      `expected ${contentType} to be rejected`,
    );
  }
});

test("rejects extension that does not match the declared content type", () => {
  assert.throws(
    () => validateUploadRequest({ filename: "malware.exe", contentType: "image/png", size: 10 }),
    (e: unknown) => e instanceof UploadPolicyError && e.code === "extension_mismatch",
  );
  // double-extension trick: declares png but ends in .svg
  assert.throws(
    () => validateUploadRequest({ filename: "evil.png.svg", contentType: "image/png", size: 10 }),
    (e: unknown) => e instanceof UploadPolicyError && e.code === "extension_mismatch",
  );
});

test("rejects unsafe filenames (path traversal / separators / hidden)", () => {
  for (const filename of [
    "../etc/passwd.png",
    "a/b.png",
    "a\\b.png",
    ".htaccess",
    "..",
    "no-ext",
  ]) {
    assert.throws(
      () => validateUploadRequest({ filename, contentType: "image/png", size: 10 }),
      (e: unknown) => e instanceof UploadPolicyError,
      `expected ${filename} to be rejected`,
    );
  }
});

test("rejects non-positive / non-integer / oversized sizes", () => {
  assert.throws(
    () => validateUploadRequest({ filename: "a.png", contentType: "image/png", size: 0 }),
    (e: unknown) => e instanceof UploadPolicyError && e.code === "invalid_size",
  );
  assert.throws(
    () => validateUploadRequest({ filename: "a.png", contentType: "image/png", size: 1.5 }),
    (e: unknown) => e instanceof UploadPolicyError && e.code === "invalid_size",
  );
  assert.throws(
    () =>
      validateUploadRequest({
        filename: "a.png",
        contentType: "image/png",
        size: DEFAULT_MAX_UPLOAD_BYTES + 1,
      }),
    (e: unknown) => e instanceof UploadPolicyError && e.code === "size_exceeded",
  );
});

test("size exactly at the ceiling is accepted", () => {
  const r = validateUploadRequest({
    filename: "a.png",
    contentType: "image/png",
    size: DEFAULT_MAX_UPLOAD_BYTES,
  });
  assert.equal(r.size, DEFAULT_MAX_UPLOAD_BYTES);
});

// ---- AC#3: server-generated, collision-resistant, unguessable pathname --------

test("builds a partitioned pathname with visibility, date and the injected id", () => {
  const pathname = buildBlobPathname({
    visibility: "private",
    extension: "png",
    id: "01HXAMPLEULIDVALUE0001",
    now: new Date("2026-06-29T12:00:00Z"),
  });
  assert.equal(pathname, "uploads/private/2026/06/01HXAMPLEULIDVALUE0001.png");
});

test("distinct ids yield distinct pathnames (collision resistance)", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const a = buildBlobPathname({ visibility: "public", extension: "pdf", id: "ID_A", now });
  const b = buildBlobPathname({ visibility: "public", extension: "pdf", id: "ID_B", now });
  assert.notEqual(a, b);
  assert.match(a, /^uploads\/public\/2026\/01\/ID_A\.pdf$/);
});
