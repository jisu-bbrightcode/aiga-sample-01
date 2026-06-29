import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCursorPage, decodeCursor, encodeCursor } from "./cursor";

test("encode → decode round-trips createdAt + id", () => {
  const when = new Date("2026-06-29T10:00:00.000Z");
  const token = encodeCursor(when, "a1");
  const decoded = decodeCursor(token);
  assert.deepEqual(decoded, { createdAt: when.toISOString(), id: "a1" });
});

test("decode rejects garbage and missing fields → null (first page fallback)", () => {
  assert.equal(decodeCursor(undefined), null);
  assert.equal(decodeCursor(""), null);
  assert.equal(decodeCursor("not-base64!!"), null);
  assert.equal(decodeCursor(Buffer.from("{}", "utf8").toString("base64url")), null);
  assert.equal(
    decodeCursor(Buffer.from(JSON.stringify({ createdAt: "nope", id: "x" })).toString("base64url")),
    null,
  );
  assert.equal(
    decodeCursor(
      Buffer.from(JSON.stringify({ createdAt: "2026-01-01T00:00:00.000Z" })).toString("base64url"),
    ),
    null,
  );
});

test("buildCursorPage drops the sentinel row and emits nextCursor when more exist", () => {
  const rows = [
    { id: "r1", createdAt: new Date("2026-06-29T03:00:00.000Z") },
    { id: "r2", createdAt: new Date("2026-06-29T02:00:00.000Z") },
    { id: "r3", createdAt: new Date("2026-06-29T01:00:00.000Z") },
  ];
  const page = buildCursorPage(rows, 2);
  assert.equal(page.items.length, 2);
  assert.deepEqual(
    page.items.map((r) => r.id),
    ["r1", "r2"],
  );
  assert.ok(page.nextCursor);
  assert.deepEqual(decodeCursor(page.nextCursor), {
    createdAt: rows[1]!.createdAt.toISOString(),
    id: "r2",
  });
});

test("buildCursorPage with no extra row returns nextCursor=null (last page)", () => {
  const rows = [{ id: "r1", createdAt: new Date("2026-06-29T03:00:00.000Z") }];
  const page = buildCursorPage(rows, 2);
  assert.equal(page.items.length, 1);
  assert.equal(page.nextCursor, null);
});

test("buildCursorPage on empty result returns empty page", () => {
  const page = buildCursorPage([] as { id: string; createdAt: Date }[], 20);
  assert.deepEqual(page, { items: [], nextCursor: null });
});
