import * as dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

dotenv.config({ path: "../../.env.local" });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required (check .env.local)");
}

export default defineConfig({
  // 스키마 배열로 관리
  schema: ["./src/schema/index.ts"],
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: DATABASE_URL,
  },
  // 시스템 테이블 제외, public 스키마만 관리
  schemaFilter: ["public"],
  // 관리할 테이블 명시 (실제 pgTable 이름과 일치해야 함)
  tablesFilter: [
    // core
    "profiles",
    "files",
    "reviews",
    "review_helpful",
    "review_reports",
    "review_summary",
    "rate_limits",
    "roles",
    "permissions",
    "role_permissions",
    "user_roles",
    // better-auth core tables
    "users",
    "sessions",
    "accounts",
    "verifications",
    "organizations",
    "members",
    "invitations",
    "jwks",
    // terms & user preferences
    "terms",
    "user_preferences",
    "integration_connections",
    // [ATLAS:TABLES]
    "blog_posts",
    "blog_tags",
    "blog_post_tags",
    "blog_claps",
    "blog_responses",
    "blog_bookmarks",
    "comment_comments",
    "community_communities",
    "community_posts",
    "community_comments",
    "community_votes",
    "community_memberships",
    "community_moderators",
    "community_rules",
    "community_flairs",
    "community_reports",
    "community_bans",
    "community_mod_logs",
    "community_saved_posts",
    "community_user_karma",
    "email_logs",
    "email_templates",
    "email_template_versions",
    "message_sending_requests",
    "message_sending_messages",
    "message_sending_provider_events",
    "notification_notifications",
    "notification_settings",
    "reaction_reactions",
    "system_scheduled_jobs",
    "system_job_runs",
    // features/onboarding
    "onboarding_user_onboarding",
    // features/payment
    "payment_plans",
    "payment_top_up_packages",
    "payment_model_pricing",
    "payment_customers",
    "payment_subscriptions",
    "payment_subscription_events",
    "payment_orders",
    "payment_credit_ledger",
    "payment_coupons",
    "payment_coupon_redemptions",
    "payment_audit_log",
    "payment_pending_plan_changes",
    "payment_usage_ledger",
    "payment_extra_usage_settings",
    "payment_usage_reserves",
    "payment_recharge_history",
    // features/project
    "project_projects",
    // features/story
    "story_worlds",
    "story_characters",
    "story_locations",
    "story_factions",
    "story_codex",
    "story_drafts",
    "story_tags",
    "story_entity_tags",
    "story_relations",
    "story_entity_properties",
    // features/localization
    "loc_languages",
    "loc_translations",
    "loc_glossary",
    // features/character-chat
    "character_actors",
    "character_actor_snapshots",
    "character_chat_threads",
    "character_chat_messages",
    "character_chat_list_preferences",
    // features/service-domain (PB-DATA-001)
    "service_specialties",
    "service_regions",
    "service_hospitals",
    "service_doctors",
    "service_doctor_specialties",
    "service_doctor_hospitals",
    // features/user-grade (PB-DATA-FR001-001)
    "user_grade_definitions",
    "user_grades",
    "user_daily_usage",
    // features/service-search (PB-DATA-FR003 / BBR-521)
    "service_search_documents",
    "service_search_synonyms",
    "service_search_queries",
    // [/ATLAS:TABLES]
  ],
  verbose: true,
  strict: false,
});
