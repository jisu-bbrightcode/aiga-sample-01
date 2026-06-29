import { createProductBuilderApi } from "@repo/api-client";
import { API_URL, getAuthHeaders } from "./auth-headers";

/** Shared REST client + React Query bindings against the NestJS server. */
export const { client: apiClient, $api } = createProductBuilderApi({
  baseUrl: API_URL,
  getHeaders: getAuthHeaders,
});
