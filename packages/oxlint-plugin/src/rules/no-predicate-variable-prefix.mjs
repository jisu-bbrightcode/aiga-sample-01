const FORBIDDEN_PREFIXES = new Set([
  "are",
  "be",
  "been",
  "being",
  "can",
  "could",
  "had",
  "has",
  "have",
  "is",
  "may",
  "might",
  "must",
  "shall",
  "should",
  "was",
  "were",
  "will",
  "would",
]);

const noPredicateVariablePrefix = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow predicate-style prefixes on value variable names.",
    },
    messages: {
      forbiddenPrefix:
        "Avoid predicate prefix '{{prefix}}' for value variable '{{name}}'. Use a noun phrase, or make it a function if it answers a question.",
    },
    schema: [],
  },
  createOnce(context) {
    return {
      VariableDeclarator(node) {
        if (isFunctionValuedVariable(node)) return;

        for (const identifier of getBindingIdentifiers(node.id)) {
          const prefix = getForbiddenPredicatePrefix(identifier.name);

          if (prefix !== undefined) {
            context.report({
              node: identifier,
              messageId: "forbiddenPrefix",
              data: {
                name: identifier.name,
                prefix,
              },
            });
          }
        }
      },
    };
  },
};

export {
  FORBIDDEN_PREFIXES,
  getBindingIdentifiers,
  getForbiddenPredicatePrefix,
  isFunctionValuedVariable,
  noPredicateVariablePrefix,
};

/* -------------------------------------------------------------------------------------------------
 * Helpers
 * -----------------------------------------------------------------------------------------------*/

function getBindingIdentifiers(pattern) {
  if (pattern === null || pattern === undefined) return [];

  if (pattern.type === "Identifier") return [pattern];

  if (pattern.type === "AssignmentPattern") {
    return getBindingIdentifiers(pattern.left);
  }

  if (pattern.type === "RestElement") {
    return getBindingIdentifiers(pattern.argument);
  }

  if (pattern.type === "ArrayPattern") {
    return pattern.elements.flatMap((element) =>
      element === null ? [] : getBindingIdentifiers(element),
    );
  }

  if (pattern.type === "ObjectPattern") {
    return pattern.properties.flatMap((property) => {
      if (property === null || property === undefined) return [];
      if (property.type === "RestElement") return getBindingIdentifiers(property.argument);

      return getBindingIdentifiers(property.value);
    });
  }

  return [];
}

function getForbiddenPredicatePrefix(identifierName) {
  const firstWord = getFirstIdentifierWord(identifierName);

  if (!FORBIDDEN_PREFIXES.has(firstWord)) return undefined;

  return firstWord;
}

function getFirstIdentifierWord(identifierName) {
  const normalizedName = identifierName.replace(/^[$_]+/, "");
  const snakeCaseMatch = normalizedName.match(/^([a-zA-Z]+)(?:[_-]|$)/);

  if (snakeCaseMatch && normalizedName.includes("_")) {
    return snakeCaseMatch[1].toLowerCase();
  }

  const camelCaseMatch = normalizedName.match(/^[a-z]+(?=[A-Z0-9_]|$)/);

  return (camelCaseMatch?.[0] ?? normalizedName).toLowerCase();
}

function isFunctionValuedVariable(node) {
  return isFunctionLikeExpression(unwrapExpression(node.init));
}

function unwrapExpression(expression) {
  if (expression === null) return null;

  if (
    expression.type === "ParenthesizedExpression" ||
    expression.type === "TSAsExpression" ||
    expression.type === "TSInstantiationExpression" ||
    expression.type === "TSNonNullExpression" ||
    expression.type === "TSSatisfiesExpression" ||
    expression.type === "TSTypeAssertion"
  ) {
    return unwrapExpression(expression.expression);
  }

  return expression;
}

function isFunctionLikeExpression(expression) {
  return (
    expression?.type === "ArrowFunctionExpression" || expression?.type === "FunctionExpression"
  );
}
