type RuntimeEnv = { VERCEL?: string };

export function shouldLoadLocalEnvFiles(env: RuntimeEnv = process.env): boolean {
  return !env.VERCEL;
}
