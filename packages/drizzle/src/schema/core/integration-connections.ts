import { jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { organization } from "./auth-tables";

/**
 * Integration Connections table
 *
 * Stores OAuth/API connections between an organization and external providers
 * (e.g. GitHub, Linear, Slack). One row per org+provider pair.
 */
export const integrationConnections = pgTable(
  "integration_connections",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    providerId: text("provider_id").notNull(),
    status: text("status", {
      enum: ["connected", "disconnected", "error"],
    })
      .notNull()
      .default("disconnected"),
    externalOrgName: text("external_org_name"),
    config: jsonb("config"),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    connectedAt: timestamp("connected_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_integration_org_provider").on(table.organizationId, table.providerId),
  ],
);

// ============================================================================
// Type Exports
// ============================================================================

export type IntegrationConnection = typeof integrationConnections.$inferSelect;
export type NewIntegrationConnection = typeof integrationConnections.$inferInsert;
