/**
 * Better Auth Server Configuration
 *
 * Drizzle adapter + JWT (JWKS RS256) + Organization plugin
 */
import * as dotenv from "dotenv";
import { shouldLoadLocalEnvFiles } from "../env/local-env";

// Load env vars for standalone usage (outside NestJS bootstrap)
if (shouldLoadLocalEnvFiles(process.env)) {
  dotenv.config({ path: ".env.local", quiet: true });
}

import { schema } from "@repo/drizzle";
import { ANALYTICS_EVENTS, captureServerEvent } from "../analytics";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, jwt, magicLink, organization } from "better-auth/plugins";
import { genericOAuth } from "better-auth/plugins/generic-oauth";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sendAuthVerificationEmail } from "./email-verification-sender";
import { sendAuthMagicLinkEmail } from "./magic-link-sender";
import { sendAuthOrganizationInvitationEmail } from "./organization-invitation-sender";
import { resolveTrustedOrigins } from "./origins";
import { sendAuthPasswordChangedEmail } from "./password-changed-sender";
import { sendAuthPasswordResetEmail } from "./password-reset-sender";
import { buildPasswordResetUrl } from "./password-reset-url";
import { buildAuthJwtPayload, type AuthJwtPayloadSource } from "./jwt-payload";

// Standalone DB instance for Better Auth (outside NestJS DI)
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required for Better Auth");
}
const client = postgres(connectionString, { max: 5 });
const db = drizzle(client, { schema });

const baseURL =
  process.env.BETTER_AUTH_URL ||
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:3002";

const trustedOrigins = resolveTrustedOrigins(process.env);

export const auth = betterAuth({
  baseURL,
  trustedOrigins,
  secret: process.env.BETTER_AUTH_SECRET || "dev-secret-change-in-production",
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
  }),
  advanced: {
    // dev: __Secure- 접두사 제거 + http 허용 (Electron localhost)
    useSecureCookies: process.env.NODE_ENV === "production",
    defaultCookieAttributes: {
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      secure: process.env.NODE_ENV === "production",
    },
  },
  emailAndPassword: {
    enabled: true,
    // 이메일 인증 전 로그인 차단. 미인증 유저가 signIn.email 호출하면 403 + verification 이메일 재발송.
    // dev/test 환경에서는 비활성화 (NODE_ENV !== "production").
    requireEmailVerification: process.env.NODE_ENV === "production",
    sendResetPassword: async ({ token, url, user }) => {
      try {
        await sendAuthPasswordResetEmail({
          token,
          url: buildPasswordResetUrl(url, token),
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
          },
        });
      } catch (e) {
        console.error("[auth] sendResetPassword failed:", e);
        throw e;
      }
    },
    onPasswordReset: async ({ user }) => {
      try {
        await sendAuthPasswordChangedEmail({
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
          },
        });
      } catch (e) {
        console.error("[auth] onPasswordReset notification failed:", e);
      }
    },
  },
  emailVerification: {
    // 회원가입 직후 자동 발송
    sendOnSignUp: true,
    // 사용자가 인증 링크 클릭 시 자동 로그인
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      // Better Auth 가 주는 url 은 /api/auth/verify-email?token=...&callbackURL=... 형태.
      try {
        await sendAuthVerificationEmail({
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
          },
          url,
        });
      } catch (e) {
        console.error("[auth] sendVerificationEmail failed:", e);
        throw e;
      }
    },
  },
  // OAuth 계정 자동 링크 정책.
  // trustedProviders 는 이메일이 이미 verified 인 것으로 취급되는 provider 목록 — 이 provider 의 이메일이
  // 기존 verified 이메일 유저와 일치할 경우에만 자동 링크. 미인증 credential 유저와는 링크하지 않음.
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "linkedin", "kakao", "naver"],
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      enabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      // OAuth 로그인마다 Google 의 name/picture 로 users.name/image 덮어쓰기
      overrideUserInfoOnSignIn: true,
    },
    linkedin: {
      clientId: process.env.LINKEDIN_CLIENT_ID ?? "",
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET ?? "",
      enabled: !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET),
      overrideUserInfoOnSignIn: true,
    },
  },
  plugins: [
    magicLink({
      expiresIn: 60 * 10,
      sendMagicLink: async ({ email, token, url }) => {
        try {
          await sendAuthMagicLinkEmail({ email, token, url });
        } catch (e) {
          console.error("[auth] sendMagicLink failed:", e);
          throw e;
        }
      },
    }),
    organization({
      creatorRole: "owner",
      sendInvitationEmail: async (data, request) => {
        try {
          await sendAuthOrganizationInvitationEmail({ ...data, request });
        } catch (e) {
          console.error("[auth] sendInvitationEmail failed:", e);
          throw e;
        }
      },
    }),
    jwt({
      jwks: {
        keyPairConfig: { alg: "RS256" },
      },
      jwt: {
        issuer: baseURL,
        audience: baseURL,
        expirationTime: "1h",
        definePayload: async (session) => buildAuthJwtPayload(session as AuthJwtPayloadSource),
      },
    }),
    // Opaque 세션 토큰을 Authorization: Bearer 로 보내는 클라이언트 지원 —
    // before hook 이 bearer 토큰을 세션 쿠키로 변환한 뒤 일반 세션 검증을 태운다.
    // (apps/app getAuthHeaders 가 session.session.token 을 Bearer 로 전송.
    // REST BetterAuthGuard / tRPC createContext 의 getSession fallback 이
    // 쿠키 없이 bearer 만 와도 세션을 해석할 수 있게 함. 토큰 자체는 DB 세션과
    // 대조되므로 검증 강도는 쿠키와 동일.)
    bearer(),
    // Kakao / Naver — Better Auth 내장 social-providers 에 없어서 generic-oauth 플러그인으로 등록.
    // 클라이언트에서는 authClient.signIn.oauth2({ providerId: "kakao" }) 형식으로 호출.
    // Callback URL 패턴: {BETTER_AUTH_URL}/api/auth/oauth2/callback/{providerId}
    genericOAuth({
      config: [
        {
          providerId: "kakao",
          clientId: process.env.KAKAO_CLIENT_ID ?? "",
          clientSecret: process.env.KAKAO_CLIENT_SECRET ?? "",
          authorizationUrl: "https://kauth.kakao.com/oauth/authorize",
          tokenUrl: "https://kauth.kakao.com/oauth/token",
          userInfoUrl: "https://kapi.kakao.com/v2/user/me",
          scopes: ["profile_nickname", "account_email"],
          overrideUserInfo: true,
          getUserInfo: async (tokens) => {
            const res = await fetch("https://kapi.kakao.com/v2/user/me", {
              headers: { Authorization: `Bearer ${tokens.accessToken}` },
            });
            if (!res.ok) return null;
            const data = (await res.json()) as {
              id: number | string;
              kakao_account?: {
                email?: string;
                is_email_verified?: boolean;
                profile?: { nickname?: string; profile_image_url?: string };
              };
              properties?: { nickname?: string; profile_image?: string };
            };
            return {
              id: String(data.id),
              email: data.kakao_account?.email ?? "",
              emailVerified: !!data.kakao_account?.is_email_verified,
              name:
                data.properties?.nickname ??
                data.kakao_account?.profile?.nickname ??
                "카카오 사용자",
              image:
                data.properties?.profile_image ?? data.kakao_account?.profile?.profile_image_url,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
          },
        },
        {
          providerId: "naver",
          clientId: process.env.NAVER_CLIENT_ID ?? "",
          clientSecret: process.env.NAVER_CLIENT_SECRET ?? "",
          authorizationUrl: "https://nid.naver.com/oauth2.0/authorize",
          tokenUrl: "https://nid.naver.com/oauth2.0/token",
          userInfoUrl: "https://openapi.naver.com/v1/nid/me",
          scopes: ["name", "email", "profile_image"],
          overrideUserInfo: true,
          getUserInfo: async (tokens) => {
            const res = await fetch("https://openapi.naver.com/v1/nid/me", {
              headers: { Authorization: `Bearer ${tokens.accessToken}` },
            });
            if (!res.ok) return null;
            const data = (await res.json()) as {
              response?: {
                id?: string;
                email?: string;
                name?: string;
                nickname?: string;
                profile_image?: string;
              };
            };
            const r = data.response ?? {};
            return {
              id: String(r.id ?? ""),
              email: r.email ?? "",
              emailVerified: true,
              name: r.name ?? r.nickname ?? "네이버 사용자",
              image: r.profile_image,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
          },
        },
      ],
    }),
  ],
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // 신규 가입 단일 발화점 — email/OAuth 모두 user.create 를 1회 거친다.
          // method 분해는 person property auth_provider(account.create.after) 로.
          captureServerEvent({ distinctId: user.id, event: ANALYTICS_EVENTS.SIGNUP_COMPLETED });
          // Sync Better Auth user to profiles table for FK compatibility
          try {
            const { profiles } = await import("@repo/drizzle");
            await db
              .insert(profiles)
              .values({
                id: user.id,
                name: user.name,
                email: user.email,
                avatar: user.image,
              })
              .onConflictDoNothing();
          } catch (e) {
            console.error("Failed to sync user (create) to profiles:", e);
          }
        },
      },
      update: {
        after: async (user) => {
          // OAuth overrideUserInfoOnSignIn 이 users.name/image 를 갱신한 뒤 profiles 도 맞춰 동기화.
          try {
            const { profiles } = await import("@repo/drizzle");
            const { eq } = await import("drizzle-orm");
            await db
              .update(profiles)
              .set({
                name: user.name,
                email: user.email,
                avatar: user.image,
                updatedAt: new Date(),
              })
              // biome-ignore lint/suspicious/noTsIgnore: drizzle-orm dual resolution shows up as an error only with the strict tsconfig used by `core` itself; consumers (apps/server) merge the resolution and would trip on an unused @ts-expect-error.
              // @ts-ignore — drizzle-orm 가 pnpm virtual store 에서 dual `resolution-mode` 로 두 번 resolve 되어 SQL<unknown> 타입이 분리됨 (runtime 동일 instance).
              .where(eq(profiles.id, user.id));
          } catch (e) {
            console.error("Failed to sync user (update) to profiles:", e);
          }
        },
      },
    },
    account: {
      create: {
        after: async (account) => {
          // 새 OAuth 연결 시 profiles.auth_provider 를 갱신 (credential 이 아닌 provider 우선).
          if (account.providerId === "credential") return;
          try {
            const { profiles } = await import("@repo/drizzle");
            const { eq } = await import("drizzle-orm");
            await db
              .update(profiles)
              .set({
                authProvider: account.providerId as
                  | "email"
                  | "google"
                  | "naver"
                  | "kakao"
                  | "linkedin",
                updatedAt: new Date(),
              })
              // biome-ignore lint/suspicious/noTsIgnore: see note in the user.update branch above.
              // @ts-ignore — drizzle-orm dual resolution (위 동일 사유).
              .where(eq(profiles.id, account.userId));
          } catch (e) {
            console.error("Failed to sync account provider to profiles:", e);
          }
        },
      },
    },
  },
});
