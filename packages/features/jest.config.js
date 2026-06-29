/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ["js", "json", "ts", "tsx"],
  rootDir: ".",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.(t|j)sx?$": [
      "ts-jest",
      {
        tsconfig: {
          module: "CommonJS",
          moduleResolution: "node",
        },
      },
    ],
  },
  collectCoverageFrom: [
    "**/*.(t|j)s",
    "!**/*.spec.ts",
    "!**/node_modules/**",
    "!**/__test-utils__/**",
  ],
  coverageDirectory: "./coverage",
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 70,
      functions: 80,
      lines: 80,
    },
  },
  testEnvironment: "node",
  testTimeout: 15000,
  moduleNameMapper: {
    // Strip .js extensions so NodeNext-style relative imports resolve to .ts
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@repo/drizzle$": "<rootDir>/../drizzle/src/index.ts",
    "^@repo/core/auth/email-verification-sender$":
      "<rootDir>/../core/auth/email-verification-sender.ts",
    "^@repo/core/auth/magic-link-sender$": "<rootDir>/../core/auth/magic-link-sender.ts",
    "^@repo/core/auth/organization-invitation-sender$":
      "<rootDir>/../core/auth/organization-invitation-sender.ts",
    "^@repo/core/auth/server$": "<rootDir>/../core/auth/server.ts",
    "^@repo/core/auth/password-changed-sender$":
      "<rootDir>/../core/auth/password-changed-sender.ts",
    "^@repo/core/auth/password-reset-sender$": "<rootDir>/../core/auth/password-reset-sender.ts",
    "^@repo/core/storage/blob$": "<rootDir>/../core/storage/blob.ts",
    "^@repo/core/(.*)$": "<rootDir>/../core/$1/index.ts",
    "^@repo/shared/(.*)$": "<rootDir>/../shared/$1",
  },
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
};
