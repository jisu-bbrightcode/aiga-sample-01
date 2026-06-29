import type { IntegrationProviderServer } from "./types";

const providers = new Map<string, IntegrationProviderServer>();

export function registerIntegration(provider: IntegrationProviderServer): void {
  providers.set(provider.id, provider);
}

export function getIntegration(id: string): IntegrationProviderServer | undefined {
  return providers.get(id);
}

export function getAllIntegrations(): IntegrationProviderServer[] {
  return Array.from(providers.values());
}
