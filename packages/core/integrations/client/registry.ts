import type { IntegrationProviderMeta } from "./types";

const metas = new Map<string, IntegrationProviderMeta>();

export function registerIntegrationMeta(meta: IntegrationProviderMeta): void {
  metas.set(meta.id, meta);
}

export function getIntegrationMeta(id: string): IntegrationProviderMeta | undefined {
  return metas.get(id);
}

export function getAllIntegrationsMeta(): IntegrationProviderMeta[] {
  return Array.from(metas.values());
}
