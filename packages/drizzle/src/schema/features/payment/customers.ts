import { pgTable, text } from "drizzle-orm/pg-core";
import { baseColumns, user } from "@repo/drizzle/schema";

/**
 * Payment Customers
 *
 * Maps a better-auth user to a Polar customer (1:1).
 */
export const paymentCustomers = pgTable("payment_customers", {
  ...baseColumns(),

  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  polarCustomerId: text("polar_customer_id").notNull().unique(),

  defaultPaymentMethodBrand: text("default_payment_method_brand"),
  defaultPaymentMethodLast4: text("default_payment_method_last4"),
});

export type PaymentCustomer = typeof paymentCustomers.$inferSelect;
export type NewPaymentCustomer = typeof paymentCustomers.$inferInsert;
