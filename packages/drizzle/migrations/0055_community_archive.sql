-- PB-COMM-SPACE-API-DELETE-001 (BBR-590) — 커뮤니티 archive/restore 생명주기.
-- 실제 삭제 대신 soft-archive: 게시글/댓글/멤버십/신고/감사 이력은 그대로 보존하고
-- 커뮤니티 행에 보관 상태(status='archived')만 표시한다. 복구(restore) 가능.
-- 감사 추적용 mod-action enum 값(archive/restore)을 추가한다.
-- Idempotent, hand-authored (0046/0052/0054 와 동일 접근).

-- 1) 커뮤니티 보관 상태 enum
DO $$ BEGIN
	CREATE TYPE "public"."community_status" AS ENUM('active', 'archived');
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint

-- 2) communities 테이블에 보관 컬럼 추가
ALTER TABLE "community_communities" ADD COLUMN IF NOT EXISTS "status" "public"."community_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "community_communities" ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "community_communities" ADD COLUMN IF NOT EXISTS "archived_by" text;--> statement-breakpoint
ALTER TABLE "community_communities" ADD COLUMN IF NOT EXISTS "archive_reason" text;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "community_communities" ADD CONSTRAINT "community_communities_archived_by_users_id_fk" FOREIGN KEY ("archived_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_communities_status" ON "community_communities" USING btree ("status");--> statement-breakpoint

-- 3) 감사 로그용 mod-action 값. 새 값은 이 마이그레이션 내 DML 에서 사용하지 않으므로
--    동일 트랜잭션에서 추가해도 안전하다.
ALTER TYPE "public"."community_mod_action" ADD VALUE IF NOT EXISTS 'archive_community';--> statement-breakpoint
ALTER TYPE "public"."community_mod_action" ADD VALUE IF NOT EXISTS 'restore_community';
