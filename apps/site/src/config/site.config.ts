import type { SiteConfig } from "@/modules/types";

/**
 * Assembly manifest — the single file the builder edits to compose a product.
 * Flip a module's `enabled`, or toggle an auth provider, and the app
 * recomposes with no other code changes.
 */
export const siteConfig: SiteConfig = {
  name: "Product Builder",
  locale: "ko",
  modules: {
    auth: {
      enabled: true,
      providers: {
        email: true,
        google: true,
        magicLink: true,
      },
    },
    // community: { enabled: false },  // reserved — added in a later increment
  },
};
