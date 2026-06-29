/**
 * no-raw-sql-query
 *
 * Disallow raw SQL queries. Two shapes are forbidden:
 *
 *   1. Drizzle `sql\`...\`` template literals passed to `.execute()` /
 *      `.run()` (full-statement execution), or invoked directly via the
 *      postgres-js raw tag (`await sql\`SELECT ...\``).
 *   2. Native client API: `db.query("SELECT ...", [...])` or
 *      `db.exec("...")` with a string-literal SQL body.
 *
 * Allowed (intentionally NOT flagged):
 *
 *   - Drizzle expression fragments:
 *       set({ col: sql\`${col} + 1\` })
 *       where(sql\`...\`)
 *       conditions.push(sql\`...\`)
 *   - Raw SQL whose body mentions a postgres feature drizzle does not
 *     express idiomatically. Pattern-matched on the literal text of the
 *     query (template OR string):
 *       - pg_advisory_xact_lock / pg_advisory_lock / pg_try_advisory_*
 *       - FOR UPDATE / FOR SHARE
 *       - sql.identifier(...) usage (dynamic identifier)
 *   - Migrations (`packages/drizzle/migrations/**`)
 *   - Scripts (`scripts/**`, `packages/drizzle/src/scripts/**`,
 *     `apps/server/src/scripts/**`)
 *   - Test files
 *
 * Inventories:
 *   - `docs/architecture/raw-sql-inventory.md` (server / features / core)
 *
 * Path scope: `apps/server/src/**`, `packages/features/**`,
 * `packages/core/**`, `packages/data/**` (.ts).
 */

const TARGET_PATH =
  /[\\/](apps[\\/]server[\\/]src|packages[\\/]features|packages[\\/]core|packages[\\/]data)[\\/].*\.tsx?$/;
const EXEMPT_PATH =
  /(?:[\\/](scripts|migrations|__tests__|packages[\\/]drizzle[\\/]src[\\/]scripts)[\\/]|[.](?:spec|test)[.]tsx?$)/;

// Methods accepting a drizzle `sql\`\`` tag for full-statement execution.
const RAW_QUERY_METHODS = new Set(["execute", "run", "unsafe"]);

// Methods accepting a string-literal SQL body.
const NATIVE_QUERY_METHODS = new Set(["query", "exec"]);

// Patterns whose presence in the template body justifies a raw query. Each
// represents a postgres-specific feature drizzle does not surface as a typed
// builder method (advisory locks, row-level locks, dynamic identifiers).
const ALLOWED_PATTERNS = [
  /\bpg_advisory_(?:xact_)?(?:try_)?(?:un)?lock(?:_shared)?\b/i,
  /\bFOR\s+UPDATE\b/i,
  /\bFOR\s+SHARE\b/i,
];

const noRawSqlQuery = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow raw SQL queries. Use drizzle query builder; reserve sql`` for expression fragments inside set/where/etc.",
    },
    messages: {
      executeRaw:
        "Do not pass a raw `sql\\`\\`` template to `.{{method}}()`. Use the drizzle query builder. This rule MUST NOT be disabled — if drizzle truly cannot express what you need, expand `ALLOWED_PATTERNS` in `packages/oxlint-plugin/src/rules/no-raw-sql-query.mjs` (with code review). Rule: docs/architecture/raw-sql-inventory.md.",
      bareAwait:
        "Do not await a `sql\\`\\`` template directly (postgres-js raw tag). Use the drizzle query builder. This rule MUST NOT be disabled. Rule: docs/architecture/raw-sql-inventory.md.",
      nativeString:
        'Do not call `.{{method}}("...")` with a literal SQL string. Use the drizzle query builder (db.insert / db.update / db.select). Dynamic table dispatch via a `Record<Kind, PgTable>` object. This rule MUST NOT be disabled. Rule: docs/architecture/raw-sql-inventory.md.',
    },
    schema: [],
  },
  createOnce(context) {
    const isTargetFile = () => {
      const f = getPhysicalFilename(context);
      return TARGET_PATH.test(f) && !EXEMPT_PATH.test(f);
    };

    return {
      // db.execute(sql`...`) / tx.execute(sql`...`) / db.run(sql`...`)
      // AND
      // db.query("SELECT ...", [...]) / db.exec("...").
      CallExpression(node) {
        if (!isTargetFile()) return;
        const callee = node.callee;
        if (!callee || callee.type !== "MemberExpression") return;
        const method = callee.property?.type === "Identifier" ? callee.property.name : null;
        if (!method) return;

        const arg = node.arguments?.[0];
        if (!arg) return;

        // Branch 1: drizzle sql`` template.
        if (RAW_QUERY_METHODS.has(method)) {
          if (arg.type !== "TaggedTemplateExpression") return;
          if (arg.tag?.type !== "Identifier" || arg.tag.name !== "sql") return;
          if (templateAllowed(arg)) return;
          context.report({ node: arg, messageId: "executeRaw", data: { method } });
          return;
        }

        // Branch 2: native `.query(string, ...)` / `.exec(string)`.
        if (NATIVE_QUERY_METHODS.has(method)) {
          const body = extractStringLiteral(arg);
          if (body === null) return;
          if (stringAllowed(body)) return;
          context.report({ node: arg, messageId: "nativeString", data: { method } });
        }
      },
      // await sql`SELECT ...` — postgres-js direct usage.
      AwaitExpression(node) {
        if (!isTargetFile()) return;
        const arg = node.argument;
        if (!arg || arg.type !== "TaggedTemplateExpression") return;
        if (arg.tag?.type !== "Identifier" || arg.tag.name !== "sql") return;
        if (templateAllowed(arg)) return;
        context.report({ node: arg, messageId: "bareAwait" });
      },
    };
  },
};

export { noRawSqlQuery };

/* ----------------------------------------------------------------------------------------------- */

function getPhysicalFilename(context) {
  return (
    context.getPhysicalFilename?.() ??
    context.physicalFilename ??
    context.filename ??
    ""
  ).replaceAll("\\", "/");
}

/**
 * Inspect the literal text of a `sql\`...\`` template and decide whether its
 * body contains a postgres feature we whitelist (advisory locks, row locks,
 * dynamic identifiers via `sql.identifier(...)`).
 */
function templateAllowed(tagged) {
  const quasi = tagged.quasi;
  if (!quasi) return false;

  // 1. Literal text patterns.
  const text = (quasi.quasis ?? []).map((q) => q?.value?.cooked ?? q?.value?.raw ?? "").join(" ");
  if (stringAllowed(text)) return true;

  // 2. AST: any interpolation is `sql.identifier(...)` or `sql.raw(...)`.
  for (const expr of quasi.expressions ?? []) {
    if (expr?.type !== "CallExpression") continue;
    const c = expr.callee;
    if (c?.type !== "MemberExpression") continue;
    if (c.object?.type !== "Identifier" || c.object.name !== "sql") continue;
    if (c.property?.type !== "Identifier") continue;
    if (c.property.name === "identifier" || c.property.name === "raw") return true;
  }
  return false;
}

// Patterns whose presence in a query body marks it as legitimate raw SQL.
// Shared between sql`` template inspection and native string inspection.
const STRING_ALLOWED_PATTERNS = [
  ...ALLOWED_PATTERNS,
];

function stringAllowed(text) {
  for (const rx of STRING_ALLOWED_PATTERNS) if (rx.test(text)) return true;
  return false;
}

/**
 * If `node` is a static string-literal (single-quoted, double-quoted, or a
 * template literal with no expressions), return the cooked text. Otherwise
 * null — dynamic strings are out of scope for this rule.
 */
function extractStringLiteral(node) {
  if (!node) return null;
  if (node.type === "Literal" && typeof node.value === "string") return node.value;
  if (node.type === "TemplateLiteral") {
    if (!node.expressions || node.expressions.length === 0) {
      return (node.quasis ?? []).map((q) => q?.value?.cooked ?? q?.value?.raw ?? "").join("");
    }
    // Has interpolations — still capture the literal portions for body inspection.
    return (node.quasis ?? []).map((q) => q?.value?.cooked ?? q?.value?.raw ?? "").join(" ");
  }
  return null;
}
