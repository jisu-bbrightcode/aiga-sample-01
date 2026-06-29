"use client";

import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { Provider as JotaiProvider } from "jotai";
import { type ReactNode, useState } from "react";
import { siteConfig } from "@/config/site.config";
import { getEnabledModules } from "@/modules/registry";

/**
 * Composition root. Wraps the app in the base providers (Jotai, React Query)
 * then nests each enabled module's Provider. New modules contribute context
 * here automatically via the registry — no edits to this file.
 */
export function ModuleProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const modules = getEnabledModules(siteConfig);

  let tree = children;
  for (const module of modules) {
    const Provider = module.Provider;
    if (Provider) tree = <Provider>{tree}</Provider>;
  }

  return (
    <JotaiProvider>
      <QueryClientProvider client={queryClient}>{tree}</QueryClientProvider>
    </JotaiProvider>
  );
}
