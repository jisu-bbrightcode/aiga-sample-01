/**
 * no-misplaced-test-file
 *
 * `.spec.ts` (jest/Playwright) 와 `.test.ts(x)` (vitest) 의 경계를 lint-time
 * 에서도 강제. write-time mirror: `.pi/extensions/rules/test-file-location.ts`.
 *
 * 검출:
 *   • spec-misplaced — *.spec.ts 가 허용 위치 밖
 *   • test-misplaced — *.test.ts(x) 가 허용 위치 밖
 *
 * 두 파일을 항상 함께 수정.
 */

const SPEC_ALLOWED = [
  /(?:^|\/)apps\/[^/]+\/tests\/e2e\//,
  /(?:^|\/)apps\/server\/src\//,
  /(?:^|\/)packages\/features\//,
  /(?:^|\/)packages\/data\//,
  /(?:^|\/)packages\/core\//,
  /(?:^|\/)packages\/drizzle\/src\//,
  /(?:^|\/)scripts\//,
  /(?:^|\/)\.pi\//,
];

const TEST_ALLOWED = [
  /(?:^|\/)apps\/app\/src\//,
  /(?:^|\/)apps\/admin\/src\//,
  /(?:^|\/)apps\/landing\/src\//,
  /(?:^|\/)apps\/electron\/src\//,
  /(?:^|\/)packages\/(?:ui|graphify)\/src\//,
  /(?:^|\/)graphify-mini\/.*\/src\//,
  // packages/core, apps/server: src/ 관례 없이 루트에 .test.ts 있음
  /(?:^|\/)packages\/core\//,
  /(?:^|\/)apps\/server\/src\//,
];

const E2E_HELPER_DIR = /(?:^|\/)apps\/[^/]+\/tests\/e2e\/_[^/]+\//;
const SPEC_EXT = /\.spec\.ts$/;
const TEST_EXT = /\.test\.(?:ts|tsx)$/;

function inAny(p, table) {
  for (const rx of table) if (rx.test(p)) return true;
  return false;
}

const noMisplacedTestFile = {
  meta: {
    name: "no-misplaced-test-file",
    type: "suggestion",
  },
  create(context) {
    const filename = context.filename || context.getFilename?.() || "";
    if (!filename) return {};
    if (E2E_HELPER_DIR.test(filename)) return {};
    const isSpec = SPEC_EXT.test(filename);
    const isTest = TEST_EXT.test(filename);
    if (!isSpec && !isTest) return {};

    return {
      Program(node) {
        if (isSpec && !inAny(filename, SPEC_ALLOWED)) {
          context.report({
            node,
            message:
              "product-builder/no-misplaced-test-file: *.spec.ts 위치 위반. " +
              "허용: apps/<app>/e2e/, apps/server/src/, packages/{features,data,core,drizzle/src}/, scripts/, .pi/ . " +
              "unit 이면 .test.ts(x) 로. " +
              "근거: .pi/extensions/rules/test-file-location.ts",
          });
        }
        if (isTest && !inAny(filename, TEST_ALLOWED)) {
          context.report({
            node,
            message:
              "product-builder/no-misplaced-test-file: *.test.ts(x) 위치 위반. " +
              "허용: apps/{app,admin,landing,electron}/src/, " +
              "packages/{ui,graphify}/src/ . " +
              "service/data 통합이면 .spec.ts 로 packages/features 또는 packages/data 안에. " +
              "근거: .pi/extensions/rules/test-file-location.ts",
          });
        }
      },
    };
  },
};

export { noMisplacedTestFile };
