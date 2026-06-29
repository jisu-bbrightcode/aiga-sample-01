import assert from "node:assert/strict";
import test from "node:test";
import { createDirectCreatorUpload } from "./upload";

test("direct creator upload forwards signed URL enforcement to Cloudflare", async () => {
  const calls: Array<{ path: string; body: unknown }> = [];
  const client = {
    requestJson(path: string, init: RequestInit) {
      calls.push({
        path,
        body: init.body ? JSON.parse(String(init.body)) : null,
      });
      return Promise.resolve({ uid: "stream-1", uploadURL: "https://upload.example" });
    },
  };

  await createDirectCreatorUpload(client as never, {
    maxDurationSeconds: 3600,
    requireSignedURLs: true,
  });

  assert.deepEqual(calls, [
    {
      path: "/stream/direct_upload",
      body: { maxDurationSeconds: 3600, requireSignedURLs: true },
    },
  ]);
});
