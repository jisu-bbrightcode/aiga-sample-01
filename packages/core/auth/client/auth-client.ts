/**
 * better-auth Client
 *
 * Singleton auth client for all React apps.
 * Points to the server which hosts the better-auth handler.
 */

import {
  genericOAuthClient,
  magicLinkClient,
  organizationClient,
  twoFactorClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

function resolveBaseURL(): string {
  if (typeof window !== "undefined") {
    // Vite injects env via import.meta.env at build time,
    // but we can also accept a runtime override on window.
    return ((window as unknown as Record<string, unknown>).__VITE_API_URL__ ??
      // biome-ignore lint/suspicious/noTsIgnore: packages/core is CJS-checked, but this branch is Vite ESM-only.
      // @ts-ignore — packages/core 는 CJS 로 type-check 되지만 이 파일은 Vite ESM 에서만 import 되어 build-time 치환됨.
      import.meta.env?.VITE_API_URL ??
      "http://localhost:3002") as string;
  }
  return "http://localhost:3002";
}

export const authClient = createAuthClient({
  baseURL: resolveBaseURL(),
  plugins: [
    organizationClient(),
    twoFactorClient(),
    genericOAuthClient(),
    magicLinkClient(),
  ],
  fetchOptions: {
    credentials: "include",
  },
});
