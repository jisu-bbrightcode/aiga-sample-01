export interface ProviderFeatureEnvOptions {
  featureName: string;
  enabledKey: string;
  placeholderProtectedKeys: readonly string[];
}

export class ProviderFeatureEnvError extends Error {
  constructor(featureName: string, message: string) {
    super(`[${featureName}.provider-env] ${message}`);
    this.name = "ProviderFeatureEnvError";
  }
}

export function isProviderFeatureEnabled(env: NodeJS.ProcessEnv, enabledKey: string): boolean {
  return env[enabledKey]?.trim().toLowerCase() === "true";
}

export function assertProviderFeatureEnvReady(
  env: NodeJS.ProcessEnv,
  options: ProviderFeatureEnvOptions,
): void {
  if (!isProviderFeatureEnabled(env, options.enabledKey)) {
    throw new ProviderFeatureEnvError(options.featureName, `${options.enabledKey} must be true`);
  }

  const placeholderKeys = options.placeholderProtectedKeys.filter((key) =>
    isTemplatePlaceholderValue(env[key]),
  );
  if (placeholderKeys.length > 0) {
    throw new ProviderFeatureEnvError(
      options.featureName,
      `replace template placeholder env values: ${placeholderKeys.join(", ")}`,
    );
  }
}

export function isTemplatePlaceholderValue(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;

  return (
    normalized.startsWith("your_") ||
    normalized.startsWith("your-") ||
    normalized.startsWith("replace_me") ||
    normalized.startsWith("replace-me") ||
    normalized === "changeme" ||
    normalized === "change_me" ||
    normalized === "todo" ||
    normalized === "placeholder"
  );
}
