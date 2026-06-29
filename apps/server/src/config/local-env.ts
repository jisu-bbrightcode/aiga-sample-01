import { resolve } from "node:path";
import { shouldLoadLocalEnvFiles } from "@repo/core/env/local-env";
import { config } from "dotenv";

export const NEST_ENV_FILE_PATHS = ["../../.env.local"];

const DOTENV_FILE_NAMES = [".env.local"];

type LoadEnvFile = (options: { path: string; quiet: true }) => unknown;

interface LoadLocalServerEnvOptions {
  baseDir?: string;
  env?: NodeJS.ProcessEnv;
  loadEnvFile?: LoadEnvFile;
}

export function getNestEnvFilePaths(env: NodeJS.ProcessEnv = process.env): string[] {
  return shouldLoadLocalEnvFiles(env) ? [...NEST_ENV_FILE_PATHS] : [];
}

export function getDotenvFilePaths(
  baseDir = __dirname,
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  if (!shouldLoadLocalEnvFiles(env)) return [];

  return DOTENV_FILE_NAMES.map((fileName) => resolve(baseDir, "../../../", fileName));
}

export function loadLocalServerEnv({
  baseDir = __dirname,
  env = process.env,
  loadEnvFile = config,
}: LoadLocalServerEnvOptions = {}) {
  for (const path of getDotenvFilePaths(baseDir, env)) {
    loadEnvFile({ path, quiet: true });
  }
}
