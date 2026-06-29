# Locked-down lint rules

Two oxlint rules are part of the data-safety harness and MUST NOT be disabled
per line or per file:

| Rule | Purpose |
| --- | --- |
| `product-builder/no-raw-sql-query` | Every SQL statement must go through the drizzle query builder. Raw `db.query("...")` / `tx.execute(sql\`...\`)` bypass the canonical schema path. |
| `product-builder/no-schema-outside-drizzle` | Every PostgreSQL table is declared once in `@repo/drizzle`. Ad-hoc `CREATE TABLE` in app code drifts from the canonical schema. |

## Enforcement layers

1. **`.pi/extensions/no-raw-sql-write.ts`** — **earliest gate**. Inspects
   every `write` / `edit` / `multi_edit` tool call from a Pi-powered agent
   and blocks the call **before the file is touched** if the new text
   contains raw SQL or a disable directive. The agent literally cannot write
   raw SQL into the protected paths.
2. **`.oxlintrc.json`** — both rules are `error`. Defence-in-depth for code
   written outside Pi (manual edits, other tooling).
3. **`scripts/forbid-rule-disable.mjs`** — greps the working tree for any
   `eslint-disable` / `oxlint-disable` directive mentioning either rule and
   exits non-zero if found.
4. **`.husky/pre-commit`** — runs the script on every commit. Blocks `git
   commit` if a disable directive sneaks in.
5. **`.github/workflows/forbid-rule-disable.yml`** — runs the script on every
   PR and push to `main` / `develop`. Catches direct push / `--no-verify`
   commits.
6. **`.github/workflows/oxlint-safety-rules.yml`** — re-runs oxlint at the CI
   gate with `--deny product-builder/no-raw-sql-query --deny product-builder/no-schema-outside-drizzle`,
   so even a malicious `.oxlintrc.json` edit can't silence them.

## Legitimate exceptions

Some PostgreSQL features (advisory locks, dynamic identifiers) cannot be expressed via drizzle. They are whitelisted at the rule
source itself, not via inline directives:

- `packages/oxlint-plugin/src/rules/no-raw-sql-query.mjs` →
  `ALLOWED_PATTERNS` (regex list of allowed SQL body patterns) and
  `EXEMPT_PATH` (path-level allow list: migrations, scripts, tests).
- Aggregate / CASE-WHEN fragments inside `qb.select({ x: sql\`...\` })` are
  already allowed — the rule only flags `.execute()` / `.run()` / `.query()` /
  `.exec()` with raw SQL bodies. Use that pattern when you genuinely need a
  bit of inline SQL inside a builder-driven query.

If neither escape hatch fits, open a PR that extends `ALLOWED_PATTERNS` (with
review), not one that disables the rule.
