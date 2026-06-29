import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfigFromFile, type UserConfig } from "vite";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const requiredDedupe = [
  "react",
  "react-dom",
  "@tanstack/react-query",
  "jotai",
  "sonner",
] as const;

const configs = [
  join(repoRoot, "apps/app/vite.config.ts"),
  join(repoRoot, "apps/admin/vite.config.ts"),
];

async function loadConfig(configPath: string): Promise<UserConfig> {
  const loaded = await loadConfigFromFile(
    { command: "build", mode: "production" },
    configPath,
    repoRoot,
    "silent",
  );

  if (!loaded) {
    throw new Error(`Could not load ${configPath}`);
  }

  return loaded.config;
}

const problems: string[] = [];

for (const configPath of configs) {
  const config = await loadConfig(configPath);
  const dedupe = new Set(config.resolve?.dedupe ?? []);
  const missing = requiredDedupe.filter((pkg) => !dedupe.has(pkg));

  if (missing.length > 0) {
    problems.push(`${relative(repoRoot, configPath)} missing resolve.dedupe: ${missing.join(", ")}`);
  }
}

if (problems.length > 0) {
  throw new Error(`Workspace React runtime dedupe is incomplete:\n${problems.join("\n")}`);
}

console.log("Vite shared React runtime dedupe is configured");
