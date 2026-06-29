/**
 * Disallow drizzle schema definitions outside `packages/drizzle/src/schema/`.
 *
 * Forbidden in `packages/features/**`: calls to `pgTable(...)`, `pgEnum(...)`,
 * `pgView(...)`, `pgMaterializedView(...)`, `sqliteTable(...)`, `mysqlTable(...)`.
 *
 * Schemas are centralized in `packages/drizzle/src/schema/**`.
 *
 * Ported from `.claude/hookify.schema-outside-drizzle.local.md` (action: block).
 */

const FORBIDDEN_PATH = /[\\/]packages[\\/]features[\\/].*\.tsx?$/;
const FORBIDDEN_CALLEES = new Set([
  "pgTable",
  "pgEnum",
  "pgView",
  "pgMaterializedView",
  "sqliteTable",
  "mysqlTable",
]);

const noSchemaOutsideDrizzle = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow defining drizzle schemas outside packages/drizzle/src/schema.",
    },
    messages: {
      schemaOutside:
        "Define drizzle schemas under packages/drizzle/src/schema/. Feature packages must not call '{{name}}'. Rule: docs/rules/feature/schema.md.",
    },
    schema: [],
  },
  createOnce(context) {
    const isTargetFile = () => FORBIDDEN_PATH.test(getPhysicalFilename(context));

    return {
      CallExpression(node) {
        if (!isTargetFile()) return;
        const callee = node.callee;
        if (!callee || callee.type !== "Identifier") return;
        if (!FORBIDDEN_CALLEES.has(callee.name)) return;
        context.report({ node, messageId: "schemaOutside", data: { name: callee.name } });
      },
    };
  },
};

export { noSchemaOutsideDrizzle };

/* ----------------------------------------------------------------------------------------------- */

function getPhysicalFilename(context) {
  return (
    context.getPhysicalFilename?.() ??
    context.physicalFilename ??
    context.filename ??
    ""
  ).replaceAll("\\", "/");
}
