import { createProductBuilderApi } from "@repo/api-client";

import { API_URL, getAuthHeaders } from "./auth-headers";

export const { client: apiClient, $api } = createProductBuilderApi({
  baseUrl: API_URL,
  getHeaders: getAuthHeaders,
});
