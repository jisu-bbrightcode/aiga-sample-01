/**
 * Schema Registry
 *
 * Combines every schema into a single object passed to Drizzle so that
 * the relational query API (`db.query.<table>.findFirst()`, etc.) works.
 *
 * Single source of truth: `./schema` (barrel export, also published as the
 * `@repo/drizzle/schema` subpath). Adding a new feature there registers it
 * here automatically — there is nothing to keep in sync.
 *
 * Non-table exports (column helpers, enums, types) get included in the
 * spread; Drizzle ignores them because only `pgTable` instances participate
 * in the relational query API.
 */

import * as schemas from "./schema";

export const schema = {
  ...schemas,
  // Better Auth (usePlural: true) looks up "jwks" + "s" = "jwkss"
  jwkss: schemas.jwks,
};

export type Schema = typeof schema;
