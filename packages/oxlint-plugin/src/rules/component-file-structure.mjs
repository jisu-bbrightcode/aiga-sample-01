const SECTION_TITLES = ["Main", "Constants", "Subcomponents", "Hooks", "Helper Functions", "Types"];

const SECTION_INDEX_BY_TITLE = new Map(SECTION_TITLES.map((title, index) => [title, index]));
const STRUCTURE_TARGET_ROOTS = ["/apps/app/src/"];

const componentFileStructure = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Require section dividers for TSX component file structure.",
    },
    messages: {
      missingSection:
        "Move this {{kind}} under the '{{sectionTitle}}' section and add the required section divider.",
      wrongSection: "This {{kind}} belongs under '{{expectedTitle}}', not '{{actualTitle}}'.",
      sectionOrder:
        "Section '{{sectionTitle}}' is out of order. Expected order: Main, Constants, Subcomponents, Hooks, Helper Functions, Types.",
      optionalText:
        "Remove '(Optional)' from section divider '{{sectionTitle}}'. Optionality is implied by omitting empty sections.",
    },
    schema: [],
  },
  createOnce(context) {
    return {
      Program(program) {
        const result = analyzeComponentFileStructure({
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
  SECTION_TITLES,
  analyzeComponentFileStructure,
  componentFileStructure,
  getExpectedSectionForStatement,
  shouldCheckComponentFileStructure,
};

/* -------------------------------------------------------------------------------------------------
 * Helpers
 * -----------------------------------------------------------------------------------------------*/

function analyzeComponentFileStructure({ comments, filePath, program }) {
  if (!shouldCheckComponentFileStructure(filePath)) {
    return { violations: [] };
  }

  const mainComponentIndex = findMainComponentIndex(program.body);

  if (mainComponentIndex === -1) {
    return { violations: [] };
  }

  const mainComponent = program.body[mainComponentIndex];
  const mainComponentName = getMainComponentName(mainComponent);
  const sections = comments.map(parseSectionComment).filter((section) => section !== null);
  const violations = getSectionCommentViolations(sections);
  const statementsBeforeMain = program.body.slice(0, mainComponentIndex);
  const statementsAfterMain = program.body.slice(mainComponentIndex + 1);
  const mainComponentSection = getNearestSectionBefore(sections, mainComponent.start);

  if (mainComponentSection === null) {
    violations.push(
      createMissingSectionViolation(mainComponent, createMainSection("main component")),
    );
  } else if (mainComponentSection.title !== "Main") {
    violations.push(
      createWrongSectionViolation(
        mainComponent,
        createMainSection("main component"),
        mainComponentSection.title,
      ),
    );
  }

  for (const statement of statementsBeforeMain) {
    if (isMainPropsStatement(statement, mainComponentName)) {
      const section = getNearestSectionBefore(sections, statement.start);
      const expectedSection = createMainSection("main props");

      if (section === null) {
        violations.push(createMissingSectionViolation(statement, expectedSection));
      } else if (section.title !== expectedSection.title) {
        violations.push(createWrongSectionViolation(statement, expectedSection, section.title));
      }
    } else if (!isAllowedBeforeMainComponent(statement, mainComponentName)) {
      const expectedSection = getExpectedSectionForStatement(statement);

      if (expectedSection !== null) {
        violations.push(createMissingSectionViolation(statement, expectedSection));
      }
    }
  }

  for (const statement of statementsAfterMain) {
    const expectedSection = isMainPropsStatement(statement, mainComponentName)
      ? createMainSection("main props")
      : getExpectedSectionForStatement(statement);

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

function getMainComponentName(statement) {
  const declaration = statement.type === "ExportNamedDeclaration" ? statement.declaration : null;

  if (declaration?.type !== "FunctionDeclaration") return null;

  return declaration.id?.name ?? null;
}

function isAllowedBeforeMainComponent(statement, mainComponentName) {
  if (statement.type === "ImportDeclaration") return true;

  return isMainPropsStatement(statement, mainComponentName);
}

function shouldCheckComponentFileStructure(filePath) {
  const normalizedPath = normalizePath(filePath);

  if (!normalizedPath.endsWith(".tsx")) return false;

  return STRUCTURE_TARGET_ROOTS.some((targetRoot) => normalizedPath.includes(targetRoot));
}

function findMainComponentIndex(statements) {
  return statements.findIndex((statement) => {
    if (statement.type !== "ExportNamedDeclaration") return false;

    const { declaration } = statement;

    return (
      declaration?.type === "FunctionDeclaration" &&
      declaration.id !== null &&
      startsWithUppercase(declaration.id.name)
    );
  });
}

function getExpectedSectionForStatement(statement) {
  const declaration = getStatementDeclaration(statement);

  if (declaration === null) return null;

  if (declaration.type === "FunctionDeclaration") {
    return getFunctionDeclarationSection(declaration);
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

function isMainPropsDeclaration(declaration, mainComponentName) {
  if (
    declaration === null ||
    (declaration.type !== "TSInterfaceDeclaration" && declaration.type !== "TSTypeAliasDeclaration")
  ) {
    return false;
  }

  const declarationName = declaration.id?.name;

  return (
    declarationName === "Props" ||
    (mainComponentName !== null && declarationName === `${mainComponentName}Props`)
  );
}

function isMainPropsStatement(statement, mainComponentName) {
  return isMainPropsDeclaration(getStatementDeclaration(statement), mainComponentName);
}

function getFunctionDeclarationSection(declaration) {
  if (declaration.id === null) return createExpectedSection("Helper Functions", "helper function");
  if (startsWithUppercase(declaration.id.name)) {
    return createExpectedSection("Subcomponents", "subcomponent");
  }
  if (declaration.id.name.startsWith("use")) return createExpectedSection("Hooks", "hook");

  return createExpectedSection("Helper Functions", "helper function");
}

function getVariableDeclarationSection(declaration) {
  const firstDeclarator = declaration.declarations[0];

  if (!firstDeclarator || firstDeclarator.id.type !== "Identifier") {
    return createExpectedSection("Constants", "constant");
  }

  const declarationName = firstDeclarator.id.name;
  const initializer = unwrapExpression(firstDeclarator.init);

  if (isFunctionLikeExpression(initializer)) {
    if (startsWithUppercase(declarationName)) {
      return createExpectedSection("Subcomponents", "subcomponent");
    }

    if (declarationName.startsWith("use")) {
      return createExpectedSection("Hooks", "hook");
    }

    return createExpectedSection("Helper Functions", "helper function");
  }

  return createExpectedSection("Constants", "constant");
}

function parseSectionComment(comment) {
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

  if (!SECTION_INDEX_BY_TITLE.has(title)) return null;

  return {
    comment,
    optionalTextFound,
    title,
  };
}

function getSectionCommentViolations(sections) {
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

    const sectionIndex = SECTION_INDEX_BY_TITLE.get(section.title);

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

function createMainSection(kind) {
  return createExpectedSection("Main", kind);
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

function startsWithUppercase(value) {
  return /^[A-Z]/.test(value);
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
