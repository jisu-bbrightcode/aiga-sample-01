/**
 * Disallow direct DB access in controllers and tRPC routers.
 *
 * Only `*.controller.ts` and `*.router.ts` files under `packages/features/**`
 * are targeted. Forbidden patterns:
 *   - this.db.* / db.* / ctx.db.* / drizzle.*
 *   - chained .query.<table>.findFirst()/findMany() / .insert(...) / .update(...) /
 *     .delete(...) / .select(...) on db-like receivers
 *
 * Move business logic into a Service.
 *
 * Ported from `.claude/hookify.business-logic-in-controller.local.md` (action: block).
 */

const PATH_MATCH = /[\\/]packages[\\/]features[\\/].*(?:controller|\.router)\.tsx?$/;
const DB_RECEIVERS = new Set(["db", "drizzle"]);
const DB_OPS = new Set(["insert", "update", "delete", "select", "query"]);

const noDbInController = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow direct DB access in controllers and tRPC routers. Move logic into a Service.",
    },
    messages: {
      directDb:
        "Controllers and tRPC routers must not access the database directly. Move this into a Service. Rule: docs/rules/backend/service-impl.md.",
    },
    schema: [],
  },
  createOnce(context) {
    const isTargetFile = () => PATH_MATCH.test(getPhysicalFilename(context));

    return {
      CallExpression(node) {
        if (!isTargetFile()) return;
        const callee = node.callee;
        if (!callee || callee.type !== "MemberExpression") return;
        const prop = callee.property?.name;
        if (!prop || !DB_OPS.has(prop)) return;
        if (!receiverLooksLikeDb(callee.object)) return;
        context.report({ node, messageId: "directDb" });
      },
    };
  },
};

export { noDbInController };

/* ----------------------------------------------------------------------------------------------- */

function receiverLooksLikeDb(node) {
  if (!node) return false;

  // Identifier:  db / drizzle
  if (node.type === "Identifier") return DB_RECEIVERS.has(node.name);

  // MemberExpression:  this.db, ctx.db, ctx.db.query, this.db.query.posts ...
  if (node.type === "MemberExpression") {
    if (node.property?.type === "Identifier" && DB_RECEIVERS.has(node.property.name)) return true;
    return receiverLooksLikeDb(node.object);
  }

  return false;
}

function getPhysicalFilename(context) {
  return (
    context.getPhysicalFilename?.() ??
    context.physicalFilename ??
    context.filename ??
    ""
  ).replaceAll("\\", "/");
}
