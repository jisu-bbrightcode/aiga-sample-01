import { boolean, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const authProviderEnum = pgEnum("auth_provider", [
  "email",
  "google",
  "naver",
  "kakao",
  "linkedin",
]);

/**
 * Profiles 테이블 (시스템 기반)
 * - Better Auth users와 연동되는 프로필 테이블
 * - 거의 모든 Feature가 참조
 * - 역할 관리는 role-permission 기능의 user_roles 테이블을 통해 처리됨
 *
 * Settings redesign (Phase 1) adds:
 * - `handle` — global-unique handle used in `product-builder.app/{handle}` URL and
 *   mentions. Variable-length, lowercase, may be NULL until the user picks one.
 * - `bio` — short freeform self-introduction shown on the member profile.
 */
export const profiles = pgTable("profiles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").unique().notNull(),
  handle: text("handle").unique(),
  bio: text("bio"),
  avatar: text("avatar"),
  authProvider: authProviderEnum("auth_provider").default("email"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  marketingConsentAt: timestamp("marketing_consent_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

// Type exports
export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
