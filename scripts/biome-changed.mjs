#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";

const COMMANDS = {
  lint: ["lint"],
  check: ["check"],
  ci: ["ci"],
  format: ["format", "--write"],
  "format:check": ["format"],
};

const [commandName, ...scopeArgs] = process.argv.slice(2);
const biomeCommand = COMMANDS[commandName];

if (!biomeCommand) {
  console.error(`Usage: biome-changed.mjs ${Object.keys(COMMANDS).join("|")} [scope ...]`);
  process.exit(2);
}

function runGit(args) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`);
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

const changed = lines(runGit(["diff", "--name-only", "--diff-filter=ACMR", "HEAD"]));
const untracked = lines(runGit(["ls-files", "--others", "--exclude-standard"]));
const files = [...new Set([...changed, ...untracked])]
  .map((file) => resolve(repoRoot, file))
  .filter((file) => existsSync(file) && isInsideScope(file))
  .map((file) => relative(process.cwd(), file) || ".");

if (files.length === 0) {
  console.log("No changed files matched the requested scope.");
  process.exit(0);
}

const result = spawnSync("biome", [...biomeCommand, "--no-errors-on-unmatched", ...files], {
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
