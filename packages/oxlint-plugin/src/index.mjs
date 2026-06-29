import { eslintCompatPlugin } from "@oxlint/plugins";
import { componentFileStructure } from "./rules/component-file-structure.mjs";
import { enforceShadcn } from "./rules/enforce-shadcn.mjs";
import { functionFileStructure } from "./rules/function-file-structure.mjs";
import { hookFileStructure } from "./rules/hook-file-structure.mjs";
import { noDbInController } from "./rules/no-db-in-controller.mjs";
import { noE2eAntiPattern } from "./rules/no-e2e-anti-pattern.mjs";
import { noFormatterIgnoreComment } from "./rules/no-formatter-ignore-comment.mjs";
import { noInlineStaticStyle } from "./rules/no-inline-static-style.mjs";
import { noLocalCssImport } from "./rules/no-local-css-import.mjs";
import { noManualMemoization } from "./rules/no-manual-memoization.mjs";
import { noMisplacedTestFile } from "./rules/no-misplaced-test-file.mjs";
import { noPredicateVariablePrefix } from "./rules/no-predicate-variable-prefix.mjs";
import { noRawSqlQuery } from "./rules/no-raw-sql-query.mjs";
import { noSchemaOutsideDrizzle } from "./rules/no-schema-outside-drizzle.mjs";
import { noUseEffectDataFetch } from "./rules/no-useeffect-data-fetch.mjs";

const plugin = eslintCompatPlugin({
  meta: {
    name: "product-builder",
  },
  rules: {
    "component-file-structure": componentFileStructure,
    "enforce-shadcn": enforceShadcn,
    "function-file-structure": functionFileStructure,
    "hook-file-structure": hookFileStructure,
    "no-db-in-controller": noDbInController,
    "no-e2e-anti-pattern": noE2eAntiPattern,
    "no-formatter-ignore-comment": noFormatterIgnoreComment,
    "no-inline-static-style": noInlineStaticStyle,
    "no-local-css-import": noLocalCssImport,
    "no-manual-memoization": noManualMemoization,
    "no-misplaced-test-file": noMisplacedTestFile,
    "no-predicate-variable-prefix": noPredicateVariablePrefix,
    "no-raw-sql-query": noRawSqlQuery,
    "no-schema-outside-drizzle": noSchemaOutsideDrizzle,
    "no-useeffect-data-fetch": noUseEffectDataFetch,
  },
});

export default plugin;
