import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  applyTranslations,
  flattenLocale,
  processLocaleDir,
  selectKeysToTranslate,
  type TranslateClient,
} from "../translate.ts";

async function withTmpDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(path.join(tmpdir(), "i18n-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("flattenLocale: nested object → dot keys", () => {
  const f = flattenLocale({ a: { b: "1" }, c: "2" });
  assert.deepEqual(f, { "a.b": "1", c: "2" });
});

test("flattenLocale: flat passes through", () => {
  const f = flattenLocale({ "a.b": "1" });
  assert.deepEqual(f, { "a.b": "1" });
});

test("selectKeysToTranslate: returns only missing keys by default", () => {
  const ko = { a: "1", b: "2", c: "3" };
  const existing = { a: "x" };
  assert.deepEqual(selectKeysToTranslate(ko, existing).sort(), ["b", "c"]);
});

test("selectKeysToTranslate: --force returns all", () => {
  const ko = { a: "1", b: "2" };
  const existing = { a: "x", b: "y" };
  assert.deepEqual(selectKeysToTranslate(ko, existing, { force: true }).sort(), ["a", "b"]);
});

test("selectKeysToTranslate: keyFilter prefix match", () => {
  const ko = { "common.brand": "1", "common.privacy": "2", "auth.signIn": "3" };
  const existing = {};
  assert.deepEqual(selectKeysToTranslate(ko, existing, { keyFilter: "common" }).sort(), [
    "common.brand",
    "common.privacy",
  ]);
});

test("applyTranslations: merges new on top of existing", () => {
  const r = applyTranslations({ a: "old", b: "old" }, { b: "new", c: "new" });
  assert.deepEqual(r, { a: "old", b: "new", c: "new" });
});

test("processLocaleDir: dry mode does not call client", async () => {
  await withTmpDir(async (tmp) => {
    await writeFile(path.join(tmp, "ko.json"), JSON.stringify({ a: "안녕", b: "테스트" }));
    await writeFile(path.join(tmp, "en.json"), JSON.stringify({}));
    let called = 0;
    const client: TranslateClient = {
      translate: () => {
        called++;
        return Promise.resolve({});
      },
    };
    void client; // referenced for type-completeness — dry mode passes null
    const result = await processLocaleDir({
      dir: tmp,
      client: null,
      targets: ["en"],
      glossary: {},
    });
    assert.equal(called, 0);
    assert.equal(result.perTarget.en.total, 2);
    assert.equal(result.perTarget.en.translated, 0);
    assert.equal(result.perTarget.en.dry, true);
    const en = JSON.parse(await readFile(path.join(tmp, "en.json"), "utf8"));
    assert.deepEqual(en, {});
  });
});

test("processLocaleDir: live mode requests only missing keys, preserves existing", async () => {
  await withTmpDir(async (tmp) => {
    await writeFile(
      path.join(tmp, "ko.json"),
      JSON.stringify({ a: "안녕", b: "테스트", c: "유지" }),
    );
    await writeFile(path.join(tmp, "en.json"), JSON.stringify({ c: "Keep" }));
    const requests: Array<{ target: string; keys: string[] }> = [];
    const client: TranslateClient = {
      translate: ({ target, pairs }) => {
        requests.push({ target, keys: Object.keys(pairs).sort() });
        const out: Record<string, string> = {};
        for (const k of Object.keys(pairs)) out[k] = `[${target}] ${pairs[k]}`;
        return Promise.resolve(out);
      },
    };
    const result = await processLocaleDir({
      dir: tmp,
      client,
      targets: ["en"],
      glossary: {},
    });
    assert.equal(requests.length, 1);
    assert.deepEqual(requests[0]?.keys, ["a", "b"]);
    assert.equal(result.perTarget.en.translated, 2);
    const en = JSON.parse(await readFile(path.join(tmp, "en.json"), "utf8"));
    assert.equal(en.a, "[en] 안녕");
    assert.equal(en.b, "[en] 테스트");
    assert.equal(en.c, "Keep", "existing translation preserved");
  });
});

test("processLocaleDir: --force replays all keys", async () => {
  await withTmpDir(async (tmp) => {
    await writeFile(path.join(tmp, "ko.json"), JSON.stringify({ a: "안녕", b: "테스트" }));
    await writeFile(path.join(tmp, "en.json"), JSON.stringify({ a: "old", b: "old" }));
    const requested: string[] = [];
    const client: TranslateClient = {
      translate: ({ pairs }) => {
        requested.push(...Object.keys(pairs));
        const out: Record<string, string> = {};
        for (const k of Object.keys(pairs)) out[k] = "NEW";
        return Promise.resolve(out);
      },
    };
    await processLocaleDir({
      dir: tmp,
      client,
      targets: ["en"],
      glossary: {},
      force: true,
    });
    assert.deepEqual(requested.sort(), ["a", "b"]);
    const en = JSON.parse(await readFile(path.join(tmp, "en.json"), "utf8"));
    assert.deepEqual(en, { a: "NEW", b: "NEW" });
  });
});
