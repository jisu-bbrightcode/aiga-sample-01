"use client";

import { siteConfig } from "@/config/site.config";
import { getEnabledModules } from "@/modules/registry";
import type { NavItem } from "@/modules/types";

function renderNavItem(item: NavItem) {
  if (item.render) return item.render();
  if (item.href) {
    return (
      <a href={item.href} className="text-muted-foreground hover:text-foreground text-sm">
        {item.label}
      </a>
    );
  }
  return null;
}

/**
 * Header composed from module nav contributions. The auth module supplies the
 * right-aligned login/user control; future modules add primary nav links.
 */
export function SiteHeader() {
  const modules = getEnabledModules(siteConfig);
  const items = modules.flatMap((module) => module.navItems?.({ config: siteConfig }) ?? []);
  const primary = items.filter((item) => item.slot !== "actions");
  const actions = items.filter((item) => item.slot === "actions");

  return (
    <header className="border-border-subtle bg-background sticky top-0 z-40 border-b">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-6">
          <a href="/" className="text-foreground text-base font-semibold">
            {siteConfig.name}
          </a>
          {primary.length > 0 ? (
            <nav className="flex items-center gap-4">
              {primary.map((item) => (
                <span key={item.id}>{renderNavItem(item)}</span>
              ))}
            </nav>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          {actions.map((item) => (
            <span key={item.id}>{item.render ? item.render() : null}</span>
          ))}
        </div>
      </div>
    </header>
  );
}
