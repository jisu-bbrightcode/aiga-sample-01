import type { ZodType } from "zod";

export type IntegrationCategory = "project" | "communication" | "storage" | "analytics" | "other";

export interface IntegrationStatus {
  connected: boolean;
  externalOrgName?: string | null;
  error?: string | null;
}

export interface IntegrationProviderServer {
  id: string;
  name: string;
  description: string;
  category: IntegrationCategory;
  configSchema?: ZodType;
  getStatus(orgId: string): Promise<IntegrationStatus>;
  connect(orgId: string, config: unknown): Promise<void>;
  disconnect(orgId: string): Promise<void>;
}
