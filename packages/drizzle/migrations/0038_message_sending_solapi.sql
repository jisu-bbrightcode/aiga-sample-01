CREATE TYPE "public"."message_sending_provider" AS ENUM('solapi');
CREATE TYPE "public"."message_sending_request_status" AS ENUM('pending', 'sent', 'partial', 'failed');
CREATE TYPE "public"."message_sending_message_status" AS ENUM('pending', 'accepted', 'sent', 'delivered', 'failed');
CREATE TYPE "public"."message_sending_event_status" AS ENUM('received', 'processed', 'ignored', 'failed');

CREATE TABLE "message_sending_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "provider" "message_sending_provider" DEFAULT 'solapi' NOT NULL,
  "status" "message_sending_request_status" DEFAULT 'pending' NOT NULL,
  "idempotency_key" text,
  "actor_id" text,
  "sender_phone" text NOT NULL,
  "provider_group_id" text,
  "provider_request_id" text,
  "total_count" integer DEFAULT 0 NOT NULL,
  "accepted_count" integer DEFAULT 0 NOT NULL,
  "failed_count" integer DEFAULT 0 NOT NULL,
  "error_code" text,
  "error_message" text,
  "sent_at" timestamp with time zone,
  "metadata" jsonb,
  "provider_response" jsonb
);

CREATE TABLE "message_sending_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "request_id" uuid NOT NULL,
  "provider" "message_sending_provider" DEFAULT 'solapi' NOT NULL,
  "status" "message_sending_message_status" DEFAULT 'pending' NOT NULL,
  "recipient_phone" text NOT NULL,
  "sender_phone" text NOT NULL,
  "message_type" text,
  "country" text DEFAULT '82' NOT NULL,
  "subject" text,
  "text_preview" text NOT NULL,
  "provider_message_id" text,
  "provider_group_id" text,
  "result_code" text,
  "result_message" text,
  "sent_at" timestamp with time zone,
  "delivered_at" timestamp with time zone,
  "failed_at" timestamp with time zone,
  "provider_payload" jsonb
);

CREATE TABLE "message_sending_provider_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "provider" "message_sending_provider" DEFAULT 'solapi' NOT NULL,
  "event_key" text NOT NULL,
  "event_type" text NOT NULL,
  "status" "message_sending_event_status" DEFAULT 'received' NOT NULL,
  "provider_message_id" text,
  "provider_group_id" text,
  "result_code" text,
  "result_message" text,
  "received_at" timestamp with time zone DEFAULT now() NOT NULL,
  "processed_at" timestamp with time zone,
  "failure_reason" text,
  "payload" jsonb NOT NULL
);

ALTER TABLE "message_sending_requests"
  ADD CONSTRAINT "message_sending_requests_actor_id_users_id_fk"
  FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "message_sending_messages"
  ADD CONSTRAINT "message_sending_messages_request_id_message_sending_requests_id_fk"
  FOREIGN KEY ("request_id") REFERENCES "public"."message_sending_requests"("id") ON DELETE cascade ON UPDATE no action;

CREATE UNIQUE INDEX "idx_msg_send_requests_idempotency" ON "message_sending_requests" USING btree ("idempotency_key");
CREATE INDEX "idx_msg_send_requests_group" ON "message_sending_requests" USING btree ("provider","provider_group_id");
CREATE INDEX "idx_msg_send_requests_status" ON "message_sending_requests" USING btree ("status","created_at");
CREATE INDEX "idx_msg_send_messages_request" ON "message_sending_messages" USING btree ("request_id");
CREATE INDEX "idx_msg_send_messages_provider_id" ON "message_sending_messages" USING btree ("provider","provider_message_id");
CREATE INDEX "idx_msg_send_messages_recipient" ON "message_sending_messages" USING btree ("recipient_phone","created_at");
CREATE INDEX "idx_msg_send_messages_status" ON "message_sending_messages" USING btree ("status","created_at");
CREATE UNIQUE INDEX "idx_msg_send_events_event_key" ON "message_sending_provider_events" USING btree ("provider","event_key");
CREATE INDEX "idx_msg_send_events_provider_id" ON "message_sending_provider_events" USING btree ("provider","provider_message_id");
CREATE INDEX "idx_msg_send_events_type" ON "message_sending_provider_events" USING btree ("event_type","created_at");
