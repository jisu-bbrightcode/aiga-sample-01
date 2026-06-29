-- PB-IDV-KCB-DATA-001 (BBR-572) — AIGA EXTEND of the base KCB identity capability.
-- Idempotent, hand-authored to avoid sweeping unrelated base-snapshot drift (same
-- approach as 0045/0046).
--
-- Delta on top of 0045_identity_verification_kcb:
--   1. Align request status enum with the contract set (add 'pending', 'canceled')
--      so success/failure/cancel/expiry/retry are fully distinguishable.
--   2. Consent capture columns on identity_verification_requests (동의 버전/범위/시각).
--   3. Minimal verified identity columns + anonymized_at on identity_verifications
--      (생년월일 masked / 성별 / 내외국인 여부).
--   4. New identity_verification_attempts table — immutable per-attempt audit log +
--      retry accounting.
--
-- Privacy invariants (unchanged, enforced by what is NOT here):
--   - No 주민등록번호(RRN) column, no raw KCB payload column anywhere.
--   - CI/DI persisted only as one-way salted hashes (ci_hash/di_hash); name/phone/
--     birthdate masked. Access to these is restricted to the admin read path.
--
-- Retention / delete / anonymization / audit-retention policy (also recorded on BBR-572):
--   - identity_verification_requests: transient handshake/rate-limit record. Prune
--     rows past expires_at after 30 days.
--   - identity_verification_attempts: audit log. Retain 3 years (개인정보/전자금융 감사),
--     then prune. Append-only; never updated in place.
--   - identity_verifications: retained_until defaults to verified_at + service retention
--     window. At expiry, anonymize in place (set anonymized_at, null out ci_hash/di_hash/
--     name_masked/phone_masked/birth_date_masked/gender/is_foreigner) or hard-delete
--     (set deleted_at). On user account deletion, FK cascade removes the row.

-- 1. Status enum alignment ----------------------------------------------------
ALTER TYPE "public"."identity_verification_request_status" ADD VALUE IF NOT EXISTS 'pending' BEFORE 'verified';--> statement-breakpoint
ALTER TYPE "public"."identity_verification_request_status" ADD VALUE IF NOT EXISTS 'canceled' BEFORE 'expired';--> statement-breakpoint

-- 2. New enums ----------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "public"."identity_verification_attempt_outcome" AS ENUM('redirected', 'verified', 'failed', 'canceled', 'expired');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."identity_verification_gender" AS ENUM('male', 'female');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

-- 3. Consent columns on requests ----------------------------------------------
ALTER TABLE "identity_verification_requests" ADD COLUMN IF NOT EXISTS "consent_version" text;--> statement-breakpoint
ALTER TABLE "identity_verification_requests" ADD COLUMN IF NOT EXISTS "consent_scope" text;--> statement-breakpoint
ALTER TABLE "identity_verification_requests" ADD COLUMN IF NOT EXISTS "consented_at" timestamp with time zone;--> statement-breakpoint

-- 4. Minimal identity + anonymization columns on verifications ----------------
ALTER TABLE "identity_verifications" ADD COLUMN IF NOT EXISTS "birth_date_masked" text;--> statement-breakpoint
ALTER TABLE "identity_verifications" ADD COLUMN IF NOT EXISTS "gender" "identity_verification_gender";--> statement-breakpoint
ALTER TABLE "identity_verifications" ADD COLUMN IF NOT EXISTS "is_foreigner" boolean;--> statement-breakpoint
ALTER TABLE "identity_verifications" ADD COLUMN IF NOT EXISTS "anonymized_at" timestamp with time zone;--> statement-breakpoint

-- 5. Attempts audit log table -------------------------------------------------
CREATE TABLE IF NOT EXISTS "identity_verification_attempts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "request_id" uuid NOT NULL,
  "attempt_no" integer NOT NULL,
  "outcome" "identity_verification_attempt_outcome" NOT NULL,
  "result_code" text,
  "failure_code" text,
  "client_ip" text,
  "user_agent" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "identity_verification_attempts" ADD CONSTRAINT "identity_verification_attempts_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."identity_verification_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "identity_verification_attempts_request_attempt_idx" ON "identity_verification_attempts" ("request_id","attempt_no");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "identity_verification_attempts_created_idx" ON "identity_verification_attempts" ("created_at" DESC);
