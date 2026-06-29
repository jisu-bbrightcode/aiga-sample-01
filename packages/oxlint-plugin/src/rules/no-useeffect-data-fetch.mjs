/**
 * Disallow API calls (fetch/axios/trpc/api/.get/.post) inside useEffect callbacks.
 *
 * Rationale: server data must be loaded via TanStack Query (tRPC). useEffect-based
 * fetching causes race conditions, duplicate requests, and breaks Suspense/SSR.
 *
 * Ported from `.claude/hookify.useeffect-data-fetch.local.md` (action: block).
 */

const noUseEffectDataFetch = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow data fetching inside useEffect callbacks.",
    },
    messages: {
      fetchInEffect:
        "Do not fetch server data inside useEffect. Use TanStack Query / tRPC hooks (useQuery, useMutation) instead. Rule: docs/rules/frontend/react-component.md §5.",
    },
    schema: [],
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (!isUseEffectCall(node)) return;
        const callback = node.arguments[0];
        if (!callback) return;
        if (callback.type !== "ArrowFunctionExpression" && callback.type !== "FunctionExpression")
          return;

        const offender = findFetchCall(callback.body);
        if (offender) {
          context.report({ node: offender, messageId: "fetchInEffect" });
        }
      },
    };
  },
};

export { noUseEffectDataFetch };

/* ----------------------------------------------------------------------------------------------- */

function isUseEffectCall(node) {
  const callee = node.callee;
  if (!callee) return false;
  if (
    callee.type === "Identifier" &&
    (callee.name === "useEffect" || callee.name === "useLayoutEffect")
  ) {
    return true;
  }
  if (
    callee.type === "MemberExpression" &&
    callee.property?.type === "Identifier" &&
    (callee.property.name === "useEffect" || callee.property.name === "useLayoutEffect")
  ) {
    return true;
  }
  return false;
}

function findFetchCall(rootNode) {
  let found = null;
  walk(rootNode, (n) => {
    if (found) return false;
    if (n.type !== "CallExpression") return true;
    if (isFetchLikeCall(n)) {
      found = n;
      return false;
    }
    return true;
  });
  return found;
}

function isFetchLikeCall(callNode) {
  const callee = callNode.callee;
  if (!callee) return false;

  // fetch(...)
  if (callee.type === "Identifier" && callee.name === "fetch") return true;

  // axios.get / axios.post / axios(...)
  if (callee.type === "MemberExpression") {
    const objectName = getRootName(callee.object);
    if (objectName === "axios") return true;

    // api.foo() / trpc.<x>.<y>.query()/mutate()
    if (objectName === "api" || objectName === "trpc") return true;

    // anything.get / .post / .put / .delete / .patch (HTTP-ish)
    if (callee.property?.type === "Identifier") {
      const method = callee.property.name;
      if (
        HTTP_METHODS.has(method) &&
        objectName !== null &&
        objectName !== "Array" &&
        objectName !== "Object"
      ) {
        return true;
      }
    }
  }
  return false;
}

const HTTP_METHODS = new Set(["get", "post", "put", "delete", "patch"]);

function getRootName(node) {
  if (!node) return null;
  if (node.type === "Identifier") return node.name;
  if (node.type === "MemberExpression") return getRootName(node.object);
  if (node.type === "CallExpression") return getRootName(node.callee);
  return null;
}

function walk(node, visit) {
  if (!node || typeof node !== "object") return;
  const cont = visit(node);
  if (cont === false) return;
  for (const key of Object.keys(node)) {
    if (key === "parent" || key === "loc" || key === "range") continue;
    const child = node[key];
    if (Array.isArray(child)) {
      for (const c of child) walk(c, visit);
    } else if (child && typeof child === "object" && typeof child.type === "string") {
      walk(child, visit);
    }
  }
}
