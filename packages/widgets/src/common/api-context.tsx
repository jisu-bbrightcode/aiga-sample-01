import type { ProductBuilderApi } from "@repo/api-client";
import { createContext, type ReactNode, useContext } from "react";

export type WidgetsApiClient = ProductBuilderApi["client"];

const WidgetsApiContext = createContext<WidgetsApiClient | null>(null);

export function WidgetsApiProvider({
  api,
  children,
}: {
  api: WidgetsApiClient;
  children: ReactNode;
}) {
  return <WidgetsApiContext.Provider value={api}>{children}</WidgetsApiContext.Provider>;
}

export function useWidgetsApi(): WidgetsApiClient {
  const api = useContext(WidgetsApiContext);
  if (!api) {
    throw new Error("useWidgetsApi must be used within <WidgetsApiProvider>");
  }
  return api;
}
