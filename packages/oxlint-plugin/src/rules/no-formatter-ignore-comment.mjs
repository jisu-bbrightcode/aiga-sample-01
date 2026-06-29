const FORMATTER_IGNORE_PATTERNS = [
  /\bprettier-ignore\b/,
  /\boxfmt-ignore\b/,
  /\boxfmt-disable\b/,
  /\boxfmt-enable\b/,
];

const noFormatterIgnoreComment = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow formatter ignore comments in source files.",
    },
    messages: {
      forbiddenFormatterIgnore:
        "Do not bypass the repository formatter with '{{directive}}'. Refactor the code so normal formatting remains readable.",
    },
    schema: [],
  },
  createOnce(context) {
    return {
      Program() {
        for (const comment of getSourceCode(context).getAllComments()) {
          const directive = getFormatterIgnoreDirective(comment.value);

          if (directive !== null) {
            context.report({
              node: comment,
              messageId: "forbiddenFormatterIgnore",
              data: {
                directive,
              },
            });
          }
        }
      },
    };
  },
};

export { FORMATTER_IGNORE_PATTERNS, getFormatterIgnoreDirective, noFormatterIgnoreComment };

/* -------------------------------------------------------------------------------------------------
 * Helpers
 * -----------------------------------------------------------------------------------------------*/

function getFormatterIgnoreDirective(commentText) {
  for (const pattern of FORMATTER_IGNORE_PATTERNS) {
    const match = commentText.match(pattern);

    if (match?.[0]) return match[0];
  }

  return null;
}

function getSourceCode(context) {
  return context.sourceCode ?? context.getSourceCode();
}
