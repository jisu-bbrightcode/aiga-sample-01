import type { ComponentType } from "react";

export interface IntegrationProviderMeta {
  id: string;
  name: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  category: string;
}
