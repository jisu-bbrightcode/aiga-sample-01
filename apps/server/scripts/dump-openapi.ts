#!/usr/bin/env tsx
/**
 * dump-openapi.ts
 *
 * Bootstrap AppModule WITHOUT listening (no port open) and write the
 * OpenAPI JSON spec to a file.
 *
 * ⚠️ STATUS: NON-FUNCTIONAL (aspirational offline path — kept for future use).
 *
 * Offline bootstrap is currently BLOCKED:
 * - tsx does not propagate experimentalDecorators to workspace packages,
 *   so NestJS decorator metadata breaks during bootstrap.
 *
 * ACTIVE MECHANISM: the sibling `dump-openapi.sh` (curl against a running
 * dev server), wired to apps/server package.json `openapi:dump`.
 * Use that instead:
 *   cd apps/server
 *   pnpm openapi:dump
 *
 * If the decorator limitation is ever resolved, intended standalone usage:
 *   cd apps/server
 *   pnpm tsx scripts/dump-openapi.ts ../../packages/api-client/openapi.json
 */

import { loadLocalServerEnv } from "../src/config/local-env";

// Load .env / .env.local BEFORE importing any module that reads process.env
loadLocalServerEnv();

import { writeFileSync } from "node:fs";
import { NestFactory } from "@nestjs/core";
import { SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "../src/app.module";
import { buildSwaggerConfig } from "../src/swagger.config";

async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });

  const config = buildSwaggerConfig();
  const document = SwaggerModule.createDocument(app, config);

  const out = process.argv[2] ?? "openapi.json";
  writeFileSync(out, JSON.stringify(document, null, 2));

  await app.close();
  console.log(`OpenAPI spec written to ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
