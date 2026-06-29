/**
 * Better Auth Client (Core)
 *
 * 기본 web cookie 기반 auth client.
 */
import { genericOAuthClient, magicLinkClient, organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

function createCoreAuthClient(baseURL: string) {
  return createAuthClient({
    baseURL,
    // genericOAuthClient — authClient.signIn.oauth2({ providerId }) 활성화. Kakao/Naver 용.
    plugins: [organizationClient(), genericOAuthClient(), magicLinkClient()],
    fetchOptions: { credentials: "include" },
  });
}

type CoreAuthClient = ReturnType<typeof createCoreAuthClient>;

let _authClient: CoreAuthClient | null = null;

export function initAuthClient(baseURL: string): CoreAuthClient {
  _authClient = createCoreAuthClient(baseURL);
  return _authClient;
}

export function getAuthClient() {
  if (!_authClient) {
    throw new Error("Auth client not initialized. Call initAuthClient(baseURL) first.");
  }
  return _authClient;
}
