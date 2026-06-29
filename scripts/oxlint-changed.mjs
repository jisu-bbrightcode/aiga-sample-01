#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";

const args = process.argv.slice(2);
const staged = args[0] === "--staged";
const scopeArgs = staged ? args.slice(1) : args;

function runGit(gitArgs) {
  const result = spawnSync("git", gitArgs, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${gitArgs.join(" ")} failed`);
  }
  return result.stdout.trim();
}

const repoRoot = runGit(["rev-parse", "--show-toplevel"]);
const scopes = (scopeArgs.length > 0 ? scopeArgs : ["."]).map((scope) =>
  resolve(process.cwd(), scope),
);

function isInsideScope(filePath) {
  return scopes.some((scope) => {
    const rel = relative(scope, filePath);
    return rel === "" || (!rel.startsWith("..") && !rel.startsWith("/"));
  });
}

function lines(output) {
  return output.length > 0 ? output.split("\n").filter(Boolean) : [];
}

const changed = staged
  ? lines(runGit(["diff", "--cached", "--name-only", "--diff-filter=ACMR"]))
  : lines(runGit(["diff", "--name-only", "--diff-filter=ACMR", "HEAD"]));
const untracked = staged ? [] : lines(runGit(["ls-files", "--others", "--exclude-standard"]));
const files = [...new Set([...changed, ...untracked])]
  .map((file) => resolve(repoRoot, file))
  .filter((file) => existsSync(file) && isInsideScope(file))
  .map((file) => relative(process.cwd(), file) || ".");

if (files.length === 0) {
  process.stdout.write("No changed files matched the requested scope.\n");
  process.exit(0);
}

const result = spawnSync("oxlint", ["--no-error-on-unmatched-pattern", ...files], {
  stdio: "inherit",
});

if (result.error) {
  process.stderr.write(`${result.error.message}\n`);
  process.exit(1);
}

process.exit(result.status ?? 1);
