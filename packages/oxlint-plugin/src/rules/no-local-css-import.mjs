/**
 * no-local-css-import
 *
 * Disallow importing local `.css` files from app/widget source.
 *
 * Tailwind utility classes (configured in the shared `styles.css`) are the
 * styling channel for this codebase. Per-feature `.css` files defeat that
 * convention and reintroduce global cascade ordering bugs.
 *
 * Forbidden:
 *   import "./tokens.css"
 *   import "../shared/buttons.css"
 *   import "@/styles/foo.css"
 *
 * Allowed:
 *   - app entry files such as `apps/web/src/main.tsx`.
 *     (entry points loading the global `styles.css` / `globals.css`)
 *   - External package CSS:  `import "@xyflow/react/dist/style.css"`
 *     (anything that does NOT start with `.` or `@/` or `~`)
 *   - shadcn primitives (`packages/ui/src/_shadcn/**`)
 */

const TARGET_PATH = /[\\/](apps|packages[\\/]widgets)[\\/].*\.(ts|tsx)$/;
const EXEMPT_PATH = /[\\/]packages[\\/]ui[\\/]src[\\/]_shadcn[\\/]/;

// Entry point files allowed to import a global stylesheet.
const ENTRY_FILES = [
  // Vite/React app entry points
  /(?:^|[\\/])apps[\\/][^/]+[\\/]src[\\/]main\.tsx?$/,
  // Next.js app router layout files (root layout owns global stylesheet)
  /(?:^|[\\/])apps[\\/][^/]+[\\/]src[\\/]app[\\/].*layout\.tsx?$/,
];

const LOCAL_PREFIX = /^(\.\.?\/|@\/|~\/|~$)/;

const noLocalCssImport = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow importing local .css files from app/widget code. Use Tailwind utility classes.",
    },
    messages: {
      localCss:
        'Do not import local CSS file "{{source}}". Use Tailwind utility classes in className. Global styles belong to the app entry point only. Rule: docs/rules/frontend/styling.md.',
    },
    schema: [],
  },
  createOnce(context) {
    const isTargetFile = () => {
      const file = getPhysicalFilename(context);
      if (!TARGET_PATH.test(file)) return false;
      if (EXEMPT_PATH.test(file)) return false;
      if (ENTRY_FILES.some((rx) => rx.test(file))) return false;
      return true;
    };

    return {
      ImportDeclaration(node) {
        if (!isTargetFile()) return;
        const source = node.source?.value;
        if (typeof source !== "string") return;
        if (!source.toLowerCase().endsWith(".css")) return;
        if (!LOCAL_PREFIX.test(source)) return;
        context.report({
          node: node.source,
          messageId: "localCss",
          data: { source },
        });
      },
    };
  },
};

export { noLocalCssImport };

/* ----------------------------------------------------------------------------------------------- */

function getPhysicalFilename(context) {
  return (
    context.getPhysicalFilename?.() ??
    context.physicalFilename ??
    context.filename ??
    ""
  ).replaceAll("\\", "/");
}
