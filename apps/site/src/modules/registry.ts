import { authModule } from "./auth";
import { catalogModule } from "./catalog";
import type { SiteConfig, SiteModule } from "./types";

/**
 * All known modules. Register a new module here; whether it actually mounts is
 * decided by its `isEnabled(config)` against `site.config.ts`.
 */
const ALL_MODULES: SiteModule[] = [catalogModule, authModule];

export function getEnabledModules(config: SiteConfig): SiteModule[] {
  return ALL_MODULES.filter((module) => module.isEnabled(config));
}
