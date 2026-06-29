import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  TUS_MAX_CHUNK_SIZE_BYTES,
  TUS_MIN_CHUNK_SIZE_BYTES,
  TUS_RECOMMENDED_CHUNK_SIZE_BYTES,
  validateTusChunkSize,
} from "./tus";

describe("Cloudflare Stream tus upload policy", () => {
  it("accepts documented recommended chunk size", () => {
    assert.equal(validateTusChunkSize(TUS_RECOMMENDED_CHUNK_SIZE_BYTES, 500_000_000), true);
  });

  it("rejects chunks below documented minimum for large files", () => {
    assert.equal(validateTusChunkSize(TUS_MIN_CHUNK_SIZE_BYTES - 1, 500_000_000), false);
  });

  it("rejects chunks above documented maximum", () => {
    assert.equal(validateTusChunkSize(TUS_MAX_CHUNK_SIZE_BYTES + 262_144, 500_000_000), false);
  });
});
