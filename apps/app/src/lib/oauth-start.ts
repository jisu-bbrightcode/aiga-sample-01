/** OAuth 시작 — web redirect only. */

import { authClient } from "./auth-client";

export type SocialProvider = "google" | "apple";
export type GenericOAuthProvider = "kakao" | "naver";
export type AnyOAuthProvider = SocialProvider | GenericOAuthProvider;

const GENERIC_PROVIDERS: ReadonlySet<string> = new Set(["kakao", "naver"]);

interface StartOAuthInput {
  provider: AnyOAuthProvider;
  callbackURL: string;
}

export async function startOAuth({ provider, callbackURL }: StartOAuthInput): Promise<void> {
  if (GENERIC_PROVIDERS.has(provider)) {
    // biome-ignore lint/suspicious/noExplicitAny: oauth2 는 genericOAuthClient 플러그인 동적 메서드.
    await (authClient.signIn as any).oauth2({ providerId: provider, callbackURL });
    return;
  }

  await authClient.signIn.social({
    provider: provider as SocialProvider,
    callbackURL,
  });
}
