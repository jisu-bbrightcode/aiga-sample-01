import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const { buildFunctionEntrySource, copyExternalRuntimePackages } = require("./vercel-output.js");

test("generated Vercel function handles CORS preflight before loading the Nest bundle", async () => {
  let requiredMain = false;
  let ended = false;
  const headers = new Map();
  const module = { exports: {} };
  const context = {
    console,
    module,
    process: { env: {} },
    require(id) {
      if (id === "./main") {
        requiredMain = true;
        throw new Error("main bundle should not load during preflight");
      }
      return require(id);
    },
  };

  vm.runInNewContext(buildFunctionEntrySource(), context);

  await module.exports(
    {
      method: "OPTIONS",
      headers: {
        origin: "https://product-builder-app.vercel.app",
        "access-control-request-headers": "content-type",
      },
    },
    {
      statusCode: 0,
      setHeader(name, value) {
        headers.set(name, value);
      },
      end() {
        ended = true;
      },
    },
  );

  assert.equal(requiredMain, false);
  assert.equal(ended, true);
  assert.equal(headers.get("Access-Control-Allow-Origin"), "https://product-builder-app.vercel.app");
  assert.equal(headers.get("Access-Control-Allow-Credentials"), "true");
});

test("generated Vercel function does not allow custom protocol preflight", async () => {
  const headers = new Map();
  let ended = false;
  const module = { exports: {} };
  const context = {
    console,
    module,
    process: { env: {} },
    require,
  };

  vm.runInNewContext(buildFunctionEntrySource(), context);

  await module.exports(
    {
      method: "OPTIONS",
      url: "/api/trpc/project.list",
      headers: {
        origin: "io.product-builder.app://app",
        "access-control-request-headers": "content-type",
      },
    },
    {
      statusCode: 0,
      setHeader(name, value) {
        headers.set(name, value);
      },
      end() {
        ended = true;
      },
    },
  );

  assert.equal(ended, true);
  assert.equal(headers.has("Access-Control-Allow-Origin"), false);
});

test("generated Vercel function reports missing required env with CORS before loading Nest", async () => {
  let requiredMain = false;
  let body = "";
  const headers = new Map();
  const module = { exports: {} };
  const context = {
    console,
    module,
    process: { env: {} },
    require(id) {
      if (id === "./main") {
        requiredMain = true;
        throw new Error("main bundle should not load when required env is missing");
      }
      return require(id);
    },
  };

  vm.runInNewContext(buildFunctionEntrySource(), context);

  await module.exports(
    {
      method: "GET",
      headers: {
        origin: "https://product-builder-app.vercel.app",
      },
    },
    {
      statusCode: 0,
      setHeader(name, value) {
        headers.set(name, value);
      },
      end(value = "") {
        body += value;
      },
    },
  );

  assert.equal(requiredMain, false);
  assert.equal(headers.get("Access-Control-Allow-Origin"), "https://product-builder-app.vercel.app");
  assert.match(body, /DATABASE_URL/);
});

test("copyExternalRuntimePackages includes sharp inside the function node_modules", () => {
  const funcDir = fs.mkdtempSync(path.join(os.tmpdir(), "product-builder-vercel-func-"));

  try {
    copyExternalRuntimePackages(funcDir);

    assert.equal(fs.existsSync(path.join(funcDir, "node_modules", "sharp", "package.json")), true);
    assert.equal(
      fs.existsSync(path.join(funcDir, "node_modules", "detect-libc", "package.json")),
      true,
    );
    assert.equal(
      fs.existsSync(path.join(funcDir, "node_modules", "color-string", "package.json")),
      true,
    );

    const imagePackagesDir = path.join(funcDir, "node_modules", "@img");
    if (fs.existsSync(imagePackagesDir)) {
      for (const entry of fs.readdirSync(imagePackagesDir)) {
        assert.equal(fs.lstatSync(path.join(imagePackagesDir, entry)).isSymbolicLink(), false);
      }
    }
  } finally {
    fs.rmSync(funcDir, { recursive: true, force: true });
  }
});
