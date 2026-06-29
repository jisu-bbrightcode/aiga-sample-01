const FUNCTION_SECTION_TITLES = ["Constants", "Main Function", "Helper Functions", "Types"];

const FUNCTION_SECTION_INDEX_BY_TITLE = new Map(
  FUNCTION_SECTION_TITLES.map((title, index) => [title, index]),
);

const functionFileStructure = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Require section dividers for TypeScript function file structure.",
    },
    messages: {
      missingSection:
        "Move this {{kind}} under the '{{sectionTitle}}' section and add the required section divider.",
      wrongSection: "This {{kind}} belongs under '{{expectedTitle}}', not '{{actualTitle}}'.",
      sectionOrder:
        "Section '{{sectionTitle}}' is out of order. Expected order: Constants, Main Function, Helper Functions, Types.",
      optionalText:
        "Remove '(Optional)' from section divider '{{sectionTitle}}'. Optionality is implied by omitting empty sections.",
    },
    schema: [],
  },
  createOnce(context) {
    return {
      Program(program) {
        const result = analyzeFunctionFileStructure({
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
  FUNCTION_SECTION_TITLES,
  analyzeFunctionFileStructure,
  functionFileStructure,
  getExpectedFunctionSectionForStatement,
  shouldCheckFunctionFileStructure,
};

/* -------------------------------------------------------------------------------------------------
 * Helpers
 * -----------------------------------------------------------------------------------------------*/

function analyzeFunctionFileStructure({ comments, filePath, program }) {
  if (!shouldCheckFunctionFileStructure(filePath)) {
    return { violations: [] };
  }

  const mainFunction = findMainFunction(program.body);

  if (mainFunction === null) {
    return { violations: [] };
  }

  const sections = comments.map(parseFunctionSectionComment).filter((section) => section !== null);
  const violations = getFunctionSectionCommentViolations(sections);

  for (const statement of program.body) {
    if (statement.type !== "ImportDeclaration") {
      const expectedSection = getExpectedFunctionSectionForStatement(statement, mainFunction);

      if (expectedSection !== null) {
        const section = getNearestSectionBefore(sections, statement.start);

        if (section === null) {
          violations.push(createMissingSectionViolation(statement, expectedSection));
        } else if (section.title !== expectedSection.title) {
          violations.push(createWrongSectionViolation(statement, expectedSection, section.title));
        }
      }
    }
  }

  return { violations };
}

function shouldCheckFunctionFileStructure(filePath) {
  return normalizePath(filePath).endsWith(".ts");
}

function findMainFunction(statements) {
  for (const statement of statements) {
    if (isNamedFunctionExport(statement)) {
      const functionName = getFunctionName(statement);

      return functionName?.startsWith("use") ? null : statement;
    }
  }

  return null;
}

function isNamedFunctionExport(statement) {
  if (statement.type !== "ExportNamedDeclaration") return false;

  const { declaration } = statement;

  if (declaration?.type === "FunctionDeclaration") {
    return declaration.id !== null;
  }

  if (declaration?.type === "VariableDeclaration") {
    const firstDeclarator = declaration.declarations[0];

    return (
      firstDeclarator?.id.type === "Identifier" &&
      isFunctionLikeExpression(unwrapExpression(firstDeclarator.init))
    );
  }

  return false;
}

function getFunctionName(statement) {
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

function getExpectedFunctionSectionForStatement(statement, mainFunction) {
  if (statement === mainFunction) {
    return createExpectedSection("Main Function", "main function");
  }

  const declaration = getStatementDeclaration(statement);

  if (declaration === null) return null;

  if (declaration.type === "FunctionDeclaration") {
    return createExpectedSection("Helper Functions", "helper function");
  }

  if (declaration.type === "VariableDeclaration") {
    return getVariableDeclarationSection(declaration);
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

function getVariableDeclarationSection(declaration) {
  const firstDeclarator = declaration.declarations[0];

  if (!firstDeclarator || firstDeclarator.id.type !== "Identifier") {
    return createExpectedSection("Constants", "constant");
  }

  if (isFunctionLikeExpression(unwrapExpression(firstDeclarator.init))) {
    return createExpectedSection("Helper Functions", "helper function");
  }

  return createExpectedSection("Constants", "constant");
}

function parseFunctionSectionComment(comment) {
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

  if (!FUNCTION_SECTION_INDEX_BY_TITLE.has(title)) return null;

  return {
    comment,
    optionalTextFound,
    title,
  };
}

function getFunctionSectionCommentViolations(sections) {
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

    const sectionIndex = FUNCTION_SECTION_INDEX_BY_TITLE.get(section.title);

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
