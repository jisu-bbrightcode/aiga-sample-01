import assert from "node:assert/strict";
import test from "node:test";
import { shouldLoadLocalEnvFiles } from "./local-env";

test("shouldLoadLocalEnvFiles disables local dotenv files on Vercel", () => {
  assert.equal(shouldLoadLocalEnvFiles({ VERCEL: "1" }), false);
});

test("shouldLoadLocalEnvFiles allows local dotenv files outside Vercel", () => {
  assert.equal(shouldLoadLocalEnvFiles({}), true);
});
