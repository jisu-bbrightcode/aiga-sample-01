/**
 * Disallow manual memoization APIs (useMemo, useCallback, React.memo).
 *
 * Rationale: this project uses React Compiler, which memoizes automatically.
 * Manual memoization is redundant and creates inconsistency.
 *
 * Ported from `.claude/hookify.manual-memo-callback.local.md` (action: block).
 */

const noManualMemoization = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow useMemo / useCallback / React.memo — React Compiler memoizes automatically.",
    },
    messages: {
      noUseMemo:
        "Do not call useMemo. React Compiler memoizes automatically. Remove it. Rule: docs/rules/frontend/react-component.md §1.",
      noUseCallback:
        "Do not call useCallback. React Compiler memoizes automatically. Remove it. Rule: docs/rules/frontend/react-component.md §1.",
      noReactMemo:
        "Do not wrap components with React.memo / memo(). React Compiler memoizes automatically. Rule: docs/rules/frontend/react-component.md §1.",
    },
    schema: [],
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (!callee) return;

        // useMemo(...) | useCallback(...)
        if (callee.type === "Identifier") {
          if (callee.name === "useMemo") {
            context.report({ node, messageId: "noUseMemo" });
            return;
          }
          if (callee.name === "useCallback") {
            context.report({ node, messageId: "noUseCallback" });
            return;
          }
          if (callee.name === "memo") {
            // bare `memo(Component)` import from react
            context.report({ node, messageId: "noReactMemo" });
            return;
          }
        }

        // React.useMemo / React.useCallback / React.memo
        if (callee.type === "MemberExpression" && callee.property?.type === "Identifier") {
          const objectName = callee.object?.type === "Identifier" ? callee.object.name : null;
          if (objectName !== "React") return;
          const prop = callee.property.name;
          if (prop === "useMemo") context.report({ node, messageId: "noUseMemo" });
          else if (prop === "useCallback") context.report({ node, messageId: "noUseCallback" });
          else if (prop === "memo") context.report({ node, messageId: "noReactMemo" });
        }
      },
    };
  },
};

export { noManualMemoization };
