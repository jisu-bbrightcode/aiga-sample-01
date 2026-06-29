/**
 * no-inline-static-style
 *
 * Disallow static inline `style={{ ... }}` values in apps and widgets.
 *
 * Rule: Tailwind utility classes are the only allowed styling channel for
 * presentational state. Inline `style` is reserved for genuinely dynamic
 * values that Tailwind cannot express (computed coordinates, runtime sizes,
 * CSS custom property injection).
 *
 * What is FORBIDDEN — a property whose value is a static literal:
 *   <div style={{ overflow: "hidden" }} />            // string literal
 *   <div style={{ top: 0 }} />                         // number literal
 *   <div style={{ display: "flex", gap: "8px" }} />   // multiple literals
 *
 * What is ALLOWED — properties with a dynamic value:
 *   <div style={{ left: x }} />                        // identifier
 *   <div style={{ height: ROW_H }} />                  // constant ref
 *   <div style={{ top: rect.top }} />                  // member access
 *   <div style={{ width: computeWidth() }} />          // call
 *   <div style={{ color: highlighted ? "red" : c }} /> // conditional
 *   <div style={{ "--token-x": value }} />             // CSS custom property
 *   <div style={mergedStyle} />                        // spread / non-object
 *
 * Path scope: `apps/**` and `packages/widgets/**` (`.tsx` only).
 * Exempt: `packages/ui/src/_shadcn/**`.
 */

const TARGET_PATH = /[\\/](apps|packages[\\/]widgets)[\\/].*\.tsx$/;
const EXEMPT_PATH = /[\\/]packages[\\/]ui[\\/]src[\\/]_shadcn[\\/]/;

const noInlineStaticStyle = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow static inline style values. Use Tailwind utility classes; reserve `style` for genuinely dynamic values.",
    },
    messages: {
      staticStyle:
        'Do not put static value "{{value}}" in style.{{prop}}. Use Tailwind className. Rule: docs/rules/frontend/styling.md.',
    },
    schema: [],
  },
  createOnce(context) {
    const isTargetFile = () => {
      const file = getPhysicalFilename(context);
      return TARGET_PATH.test(file) && !EXEMPT_PATH.test(file);
    };

    return {
      JSXAttribute(node) {
        if (!isTargetFile()) return;
        if (node.name?.type !== "JSXIdentifier" || node.name.name !== "style") return;
        const v = node.value;
        if (!v || v.type !== "JSXExpressionContainer") return;
        const expr = v.expression;
        if (!expr || expr.type !== "ObjectExpression") return;

        for (const prop of expr.properties) {
          if (prop.type !== "Property") continue;
          if (prop.shorthand || prop.computed) continue;
          const propName = getPropertyName(prop.key);
          if (!propName) continue;
          // CSS custom properties are always dynamic by convention.
          if (propName.startsWith("--")) continue;

          const valueNode = prop.value;
          if (!isStaticLiteral(valueNode)) continue;

          const printed = printLiteral(valueNode);
          context.report({
            node: prop,
            messageId: "staticStyle",
            data: { prop: propName, value: printed },
          });
        }
      },
    };
  },
};

export { noInlineStaticStyle };

/* ----------------------------------------------------------------------------------------------- */

function getPropertyName(keyNode) {
  if (!keyNode) return null;
  if (keyNode.type === "Identifier") return keyNode.name;
  if (keyNode.type === "Literal" && typeof keyNode.value === "string") return keyNode.value;
  return null;
}

function isStaticLiteral(node) {
  if (!node) return false;
  if (node.type === "Literal") return true;
  // `as const` style: TSAsExpression around a literal still resolves to a literal.
  if (node.type === "TSAsExpression" || node.type === "TSSatisfiesExpression") {
    return isStaticLiteral(node.expression);
  }
  // Unary minus / plus on numeric literal: -1, +0
  if (node.type === "UnaryExpression" && (node.operator === "-" || node.operator === "+")) {
    return isStaticLiteral(node.argument);
  }
  // Template literal with no interpolation: `hidden`
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) return true;
  return false;
}

function printLiteral(node) {
  if (node.type === "Literal") return String(node.value);
  if (node.type === "TSAsExpression" || node.type === "TSSatisfiesExpression") {
    return printLiteral(node.expression);
  }
  if (node.type === "UnaryExpression") return `${node.operator}${printLiteral(node.argument)}`;
  if (node.type === "TemplateLiteral") return node.quasis[0]?.value?.cooked ?? "";
  return "?";
}

function getPhysicalFilename(context) {
  return (
    context.getPhysicalFilename?.() ??
    context.physicalFilename ??
    context.filename ??
    ""
  ).replaceAll("\\", "/");
}
