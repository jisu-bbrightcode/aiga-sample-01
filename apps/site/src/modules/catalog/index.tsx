import type { SiteModule } from "../types";

/**
 * Catalog navigation module. Contributes the public primary nav (의사/병원/소개/
 * 이용 안내) to the site header. Always enabled — these are the SEO landing
 * surfaces, not a toggleable feature — and carries no provider, so it composes
 * through the same registry as the auth module without layout surgery.
 */
export const catalogModule: SiteModule = {
  id: "catalog",
  isEnabled: () => true,
  navItems: () => [
    { id: "nav-doctors", slot: "primary", label: "의사 찾기", href: "/doctors" },
    { id: "nav-hospitals", slot: "primary", label: "병원 찾기", href: "/hospitals" },
    { id: "nav-about", slot: "primary", label: "서비스 소개", href: "/about" },
    { id: "nav-pricing", slot: "primary", label: "이용 안내", href: "/pricing" },
  ],
};
