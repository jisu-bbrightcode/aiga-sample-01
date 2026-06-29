import type { ComponentType, ReactNode } from "react";

/**
 * Module-driven site composition.
 *
 * The web-service template is assembled from independent modules. The builder
 * (company-os-v2) turns features on/off purely through `site.config.ts`; the
 * composition root reads this config and mounts the enabled modules. Adding a
 * feature = drop a `modules/<id>/` folder exporting a `SiteModule` + register
 * it, never surgery on the layout.
 */

export interface AuthProvidersConfig {
  email: boolean;
  google: boolean;
  magicLink: boolean;
}

export interface AuthModuleConfig {
  enabled: boolean;
  providers: AuthProvidersConfig;
}

// Reserved extension point — implemented in a later increment.
export interface CommunityModuleConfig {
  enabled: boolean;
}

/**
 * SEO / brand metadata for the public site. Drives canonical URLs, Open Graph,
 * Twitter cards and JSON-LD structured data across every public page.
 */
export interface SiteSeoConfig {
  /** Canonical production origin, no trailing slash (canonical + OG URLs). */
  url: string;
  /** Short brand tagline appended to the default document title. */
  tagline: string;
  /** Default meta description / OG description. */
  description: string;
  /** Default keywords for the home document. */
  keywords?: string[];
  /** Alt text for the default Open Graph image. */
  ogImageAlt?: string;
}

export interface SiteConfig {
  name: string;
  locale: string;
  seo: SiteSeoConfig;
  modules: {
    auth?: AuthModuleConfig;
    community?: CommunityModuleConfig;
  };
}

export interface SiteModuleContext {
  config: SiteConfig;
}

export interface NavItem {
  id: string;
  /** "primary" → left nav links, "actions" → right-aligned controls. */
  slot?: "primary" | "actions";
  label?: string;
  href?: string;
  /** Custom render (e.g. login button / user menu). Takes precedence over label/href. */
  render?: () => ReactNode;
}

export interface SiteModule {
  id: string;
  isEnabled: (config: SiteConfig) => boolean;
  /** Client context provider wrapping the whole app (optional). */
  Provider?: ComponentType<{ children: ReactNode }>;
  /** Header nav contributions (optional). */
  navItems?: (ctx: SiteModuleContext) => NavItem[];
}
