const HOOK_SECTION_TITLES = ["Constants", "Hooks", "Helper Functions", "Types"];

const HOOK_SECTION_INDEX_BY_TITLE = new Map(
  HOOK_SECTION_TITLES.map((title, index) => [title, index]),
);
const HOOK_STRUCTURE_TARGET_ROOTS = ["/apps/app/src/"];

const hookFileStructure = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Require section dividers for TypeScript hook file structure.",
    },
    messages: {
      missingSection:
        "Move this {{kind}} under the '{{sectionTitle}}' section and add the required section divider.",
      wrongSection: "This {{kind}} belongs under '{{expectedTitle}}', not '{{actualTitle}}'.",
      sectionOrder:
        "Section '{{sectionTitle}}' is out of order. Expected order: Constants, Hooks, Helper Functions, Types.",
      optionalText:
        "Remove '(Optional)' from section divider '{{sectionTitle}}'. Optionality is implied by omitting empty sections.",
    },
    schema: [],
  },
  createOnce(context) {
    return {
      Program(program) {
        const result = analyzeHookFileStructure({
          comments: getSourceCode(context).getAllComments(),
          filePath: getPhysicalFilename(context),
          program,
        });

        for (const violation of result.violations) {
          context.report(violation);
        }
      },
    };
  },
};

export {
  HOOK_SECTION_TITLES,
  analyzeHookFileStructure,
  getExpectedHookSectionForStatement,
  hookFileStructure,
  shouldCheckHookFileStructure,
};

/* -------------------------------------------------------------------------------------------------
 * Helpers
 * -----------------------------------------------------------------------------------------------*/

function analyzeHookFileStructure({ comments, filePath, program }) {
  if (!shouldCheckHookFileStructure(filePath)) {
    return { violations: [] };
  }

  const mainHookIndex = findMainHookIndex(program.body);

  if (mainHookIndex === -1) {
    return { violations: [] };
  }

  const mainHook = program.body[mainHookIndex];
  const mainHookName = getHookName(mainHook);
  const sections = comments
    .map(parseHookSectionComment)
    .filter((section) => section !== null && section.comment.end > mainHook.end);
  const violations = getHookSectionCommentViolations(sections);
  const statementsBeforeMain = program.body.slice(0, mainHookIndex);
  const statementsAfterMain = program.body.slice(mainHookIndex + 1);

  for (const statement of statementsBeforeMain) {
    if (!isAllowedBeforeMainHook(statement, mainHookName)) {
      const expectedSection = getExpectedHookSectionForStatement(statement);

      if (expectedSection !== null) {
        violations.push(createMissingSectionViolation(statement, expectedSection));
      }
    }
  }

  for (const statement of statementsAfterMain) {
    const expectedSection = getExpectedHookSectionForStatement(statement);

    if (expectedSection !== null) {
      const section = getNearestSectionBefore(sections, statement.start);

      if (section === null) {
        violations.push(createMissingSectionViolation(statement, expectedSection));
      } else if (section.title !== expectedSection.title) {
        violations.push(createWrongSectionViolation(statement, expectedSection, section.title));
      }
    }
  }

  return { violations };
}

function shouldCheckHookFileStructure(filePath) {
  const normalizedPath = normalizePath(filePath);

  if (!normalizedPath.endsWith(".ts")) return false;

  return HOOK_STRUCTURE_TARGET_ROOTS.some((targetRoot) => normalizedPath.includes(targetRoot));
}

function findMainHookIndex(statements) {
  return statements.findIndex((statement) => isHookDeclaration(statement));
}

function isHookDeclaration(statement) {
  const declaration = getStatementDeclaration(statement);

  if (declaration === null) return false;

  if (declaration.type === "FunctionDeclaration") {
    return declaration.id?.name.startsWith("use") ?? false;
  }

  if (declaration.type === "VariableDeclaration") {
    const firstDeclarator = declaration.declarations[0];

    return (
      firstDeclarator?.id.type === "Identifier" &&
      firstDeclarator.id.name.startsWith("use") &&
      isFunctionLikeExpression(unwrapExpression(firstDeclarator.init))
    );
  }

  return false;
}

function getHookName(statement) {
  const declaration = getStatementDeclaration(statement);

  if (declaration?.type === "FunctionDeclaration") {
    return declaration.id?.name ?? null;
  }

  if (declaration?.type === "VariableDeclaration") {
    const firstDeclarator = declaration.declarations[0];

    return firstDeclarator?.id.type === "Identifier" ? firstDeclarator.id.name : null;
  }

  return null;
}

function isAllowedBeforeMainHook(statement, mainHookName) {
  if (statement.type === "ImportDeclaration") return true;

  const declaration = getStatementDeclaration(statement);

  return isMainHookParamsDeclaration(declaration, mainHookName);
}

function isMainHookParamsDeclaration(declaration, mainHookName) {
  if (
    declaration === null ||
    (declaration.type !== "TSInterfaceDeclaration" && declaration.type !== "TSTypeAliasDeclaration")
  ) {
    return false;
  }

  const declarationName = declaration.id?.name;
  const hookParamsName = mainHookName === null ? null : `${capitalize(mainHookName)}Params`;

  return declarationName === "Params" || declarationName === hookParamsName;
}

function getExpectedHookSectionForStatement(statement) {
  const declaration = getStatementDeclaration(statement);

  if (declaration === null) return null;

  if (declaration.type === "FunctionDeclaration") {
    return getHookFunctionDeclarationSection(declaration);
  }

  if (declaration.type === "VariableDeclaration") {
    return getHookVariableDeclarationSection(declaration);
  }

  if (
    declaration.type === "TSEnumDeclaration" ||
    declaration.type === "TSInterfaceDeclaration" ||
    declaration.type === "TSTypeAliasDeclaration"
  ) {
    return createExpectedSection("Types", "type declaration");
  }

  return null;
}

function getStatementDeclaration(statement) {
  return statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
}

function getHookFunctionDeclarationSection(declaration) {
  if (declaration.id?.name.startsWith("use")) {
    return createExpectedSection("Hooks", "hook");
  }

  return createExpectedSection("Helper Functions", "helper function");
}

function getHookVariableDeclarationSection(declaration) {
  const firstDeclarator = declaration.declarations[0];

  if (!firstDeclarator || firstDeclarator.id.type !== "Identifier") {
    return createExpectedSection("Constants", "constant");
  }

  const declarationName = firstDeclarator.id.name;
  const initializer = unwrapExpression(firstDeclarator.init);

  if (isFunctionLikeExpression(initializer)) {
    if (declarationName.startsWith("use")) {
      return createExpectedSection("Hooks", "hook");
    }

    return createExpectedSection("Helper Functions", "helper function");
  }

  return createExpectedSection("Constants", "constant");
}

function parseHookSectionComment(comment) {
  if (comment.type !== "Block") return null;

  const lines = comment.value
    .split(/\r?\n/)
    .map((line) =>
      line
        .trim()
        .replace(/^\*\s?/, "")
        .trim(),
    )
    .filter((line) => line.length > 0);
  const titleLine = lines.find((line) => !line.startsWith("-"));

  if (!titleLine) return null;

  const optionalTextFound = /\(optional\)/i.test(titleLine);
  const title = titleLine.replace(/\(optional\)/gi, "").trim();

  if (!HOOK_SECTION_INDEX_BY_TITLE.has(title)) return null;

  return {
    comment,
    optionalTextFound,
    title,
  };
}

function getHookSectionCommentViolations(sections) {
  const violations = [];
  let highestSectionIndex = -1;

  for (const section of sections) {
    if (section.optionalTextFound) {
      violations.push({
        node: section.comment,
        messageId: "optionalText",
        data: {
          sectionTitle: section.title,
        },
      });
    }

    const sectionIndex = HOOK_SECTION_INDEX_BY_TITLE.get(section.title);

    if (sectionIndex < highestSectionIndex) {
      violations.push({
        node: section.comment,
        messageId: "sectionOrder",
        data: {
          sectionTitle: section.title,
        },
      });
    }

    highestSectionIndex = Math.max(highestSectionIndex, sectionIndex);
  }

  return violations;
}

function getNearestSectionBefore(sections, statementStart) {
  return sections.findLast((section) => section.comment.end <= statementStart) ?? null;
}

function createExpectedSection(title, kind) {
  return {
    kind,
    title,
  };
}

function createMissingSectionViolation(statement, expectedSection) {
  return {
    node: statement,
    messageId: "missingSection",
    data: {
      kind: expectedSection.kind,
      sectionTitle: expectedSection.title,
    },
  };
}

function createWrongSectionViolation(statement, expectedSection, actualTitle) {
  return {
    node: statement,
    messageId: "wrongSection",
    data: {
      actualTitle,
      expectedTitle: expectedSection.title,
      kind: expectedSection.kind,
    },
  };
}

function getPhysicalFilename(context) {
  if (typeof context.physicalFilename === "string") return context.physicalFilename;
  if (typeof context.getPhysicalFilename === "function") return context.getPhysicalFilename();
  if (typeof context.filename === "string") return context.filename;
  if (typeof context.getFilename === "function") return context.getFilename();
  return "";
}

function getSourceCode(context) {
  return context.sourceCode ?? context.getSourceCode();
}

function normalizePath(filePath) {
  return `/${filePath.replaceAll("\\", "/").replace(/^\/+/, "")}`;
}

function capitalize(value) {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
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
