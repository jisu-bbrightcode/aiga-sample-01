import assert from "node:assert/strict";
import test from "node:test";
import { getNestEnvFilePaths, loadLocalServerEnv } from "./local-env";

test("getNestEnvFilePaths disables env files on Vercel", () => {
  assert.deepEqual(getNestEnvFilePaths({ VERCEL: "1" }), []);
});

test("getNestEnvFilePaths keeps repo env files for local development", () => {
  assert.deepEqual(getNestEnvFilePaths({}), ["../../.env.local"]);
});

test("loadLocalServerEnv does not call dotenv on Vercel", () => {
  const loadedPaths: string[] = [];

  loadLocalServerEnv({
    baseDir: "/repo/apps/server/dist",
    env: { VERCEL: "1" },
    loadEnvFile: ({ path }) => loadedPaths.push(path),
  });

  assert.deepEqual(loadedPaths, []);
});
