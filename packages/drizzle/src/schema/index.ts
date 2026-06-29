/**
 * Centralized Schema Exports
 *
 * Single source of truth for every drizzle schema in the project.
 * - Core schemas: packages/drizzle/src/schema/core/
 * - Feature schemas: packages/drizzle/src/schema/features/{feature-name}/
 *
 * Each feature is independently managed to minimize cross-dependencies.
 * Features should avoid directly referencing other feature schemas.
 *
 * Adding a new feature: drop a folder under `features/` and add one
 * `export * from ...` line below — `schema-registry.ts` picks it up
 * automatically.
 *
 * This file is also published as the `@repo/drizzle/schema` subpath.
 * It must NOT import NestJS modules (database.module.ts) so that drizzle-kit
 * can load it during migrations.
 */

// Schema utilities (baseColumns, timestamps, etc.)
export * from "../utils";

// Core Schemas (base tables that features depend on)
export * from "./core/auth";
export * from "./core/auth-tables";
export * from "./core/better-auth";
export * from "./core/files";
export * from "./core/integration-connections";
export * from "./core/profiles";
export * from "./core/rate-limits";
export * from "./core/reviews";
export * from "./core/role-permission";
export * from "./core/terms";
export * from "./core/user-preferences";

// Feature Schemas
export * from "./features/blog";
export * from "./features/character-chat";
export * from "./features/character-chat";
export * from "./features/comment";
export * from "./features/community";
export * from "./features/email";
export * from "./features/identity-verification";
export * from "./features/localization";
export * from "./features/message-sending";
export * from "./features/notification";
export * from "./features/onboarding";
export * from "./features/payment";
export * from "./features/project";
export * from "./features/reaction";
export * from "./features/scheduled-job";
export * from "./features/service-domain";
export * from "./features/story";
export * from "./features/video-lecture";
