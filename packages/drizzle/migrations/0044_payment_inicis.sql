DO $$ BEGIN
  CREATE TYPE "public"."payment_inicis_order_status" AS ENUM(
    'pending_auth',
    'auth_failed',
    'approved',
    'paid',
    'canceled',
    'partially_refunded',
    'refunded',
    'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."payment_inicis_event_status" AS ENUM(
    'received',
    'processed',
    'failed',
    'replayed'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_inicis_orders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "order_id" text NOT NULL,
  "user_id" text,
  "amount" integer NOT NULL,
  "currency" text DEFAULT 'KRW' NOT NULL,
  "pay_method" text NOT NULL,
  "goods_name" text NOT NULL,
  "buyer_name_masked" text,
  "buyer_email_masked" text,
  "tid" text,
  "auth_tid" text,
  "status" "payment_inicis_order_status" DEFAULT 'pending_auth' NOT NULL,
  "provider_result_code" text,
  "provider_result_message" text,
  "approved_at" timestamp with time zone,
  "paid_at" timestamp with time zone,
  "canceled_at" timestamp with time zone,
  "refunded_amount" integer DEFAULT 0 NOT NULL,
  "raw_masked" jsonb,
  "normalized" jsonb,
  CONSTRAINT "payment_inicis_orders_order_id_unique" UNIQUE("order_id"),
  CONSTRAINT "payment_inicis_orders_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_inicis_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "event_type" text NOT NULL,
  "status" "payment_inicis_event_status" DEFAULT 'received' NOT NULL,
  "order_id" text,
  "tid" text,
  "idempotency_key" text NOT NULL,
  "source_ip" text,
  "provider_result_code" text,
  "provider_result_message" text,
  "raw_masked" jsonb NOT NULL,
  "normalized" jsonb,
  "error_code" text,
  "replayed_from_event_id" text,
  "processed_at" timestamp with time zone,
  CONSTRAINT "payment_inicis_events_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_inicis_orders_tid_idx"
  ON "payment_inicis_orders" USING btree ("tid");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_inicis_events_order_idx"
  ON "payment_inicis_events" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_inicis_events_tid_idx"
  ON "payment_inicis_events" USING btree ("tid");
